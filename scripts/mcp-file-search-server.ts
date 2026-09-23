/**
 * Prosty serwer MCP (Model Context Protocol) do przeszukiwania plików na dysku.
 *
 * Uruchomienie (stdio transport, do podpięcia w kliencie MCP np. VS Code):
 *   npx tsx scripts/mcp-file-search-server.ts
 *
 * Udostępnia dwa narzędzia:
 *  - search_files_by_name: szuka plików/katalogów po nazwie (dopasowanie podciągu lub prostego wzorca * ?)
 *  - search_file_contents: szuka linii zawierających dany tekst wewnątrz plików tekstowych
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const DOMYSLNY_LIMIT = 200;
const MAKSYMALNY_LIMIT = 2000;
const ROZMIAR_LIMITU_PLIKU = 5 * 1024 * 1024; // pliki większe pomijamy przy przeszukiwaniu zawartości
const POMIJANE_KATALOGI = new Set(['node_modules', '.git', '.hg', '.svn', 'dist', 'build', '.venv']);

function nazwaPasuje(nazwa: string, wzorzec: string): boolean {
  const nazwaLower = nazwa.toLowerCase();
  const wzorzecLower = wzorzec.toLowerCase();
  if (!wzorzecLower.includes('*') && !wzorzecLower.includes('?')) {
    return nazwaLower.includes(wzorzecLower);
  }
  const regexZrodlo = wzorzecLower.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexZrodlo}$`).test(nazwaLower);
}

function* przechodzKatalog(katalog: string): Generator<string> {
  let wpisy: string[];
  try {
    wpisy = readdirSync(katalog);
  } catch {
    return; // brak dostępu / katalog zniknął w trakcie przeszukiwania
  }
  for (const wpis of wpisy) {
    const pelnaSciezka = join(katalog, wpis);
    let info;
    try {
      info = statSync(pelnaSciezka);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      if (POMIJANE_KATALOGI.has(wpis)) continue;
      yield* przechodzKatalog(pelnaSciezka);
    } else if (info.isFile()) {
      yield pelnaSciezka;
    }
  }
}

function sprawdzKatalogBazowy(katalog: string): string {
  const pelna = resolve(katalog);
  const info = statSync(pelna); // rzuca, jeśli ścieżka nie istnieje
  if (!info.isDirectory()) {
    throw new Error(`Podana ścieżka nie jest katalogiem: ${pelna}`);
  }
  return pelna;
}

const serwer = new McpServer({ name: 'przeszukiwarka-plikow', version: '1.0.0' });

serwer.registerTool(
  'search_files_by_name',
  {
    title: 'Szukaj plików po nazwie',
    description:
      'Przeszukuje rekurencyjnie wskazany katalog i zwraca ścieżki plików, których nazwa pasuje do wzorca ' +
      '(podciąg, albo wzorzec z * i ?). Pomija node_modules, .git i podobne katalogi.',
    inputSchema: {
      directory: z.string().describe('Katalog startowy przeszukiwania, np. C:\\Users\\Ja\\Dokumenty'),
      pattern: z.string().describe('Fragment nazwy pliku albo wzorzec z * i ?, np. "*.ts" lub "raport"'),
      maxResults: z.number().int().positive().max(MAKSYMALNY_LIMIT).optional(),
    },
  },
  async ({ directory, pattern, maxResults }) => {
    const limit = maxResults ?? DOMYSLNY_LIMIT;
    try {
      const katalogBazowy = sprawdzKatalogBazowy(directory);
      const wyniki: string[] = [];
      for (const sciezka of przechodzKatalog(katalogBazowy)) {
        const nazwaPliku = sciezka.slice(sciezka.lastIndexOf('\\') + 1).slice(sciezka.lastIndexOf('/') + 1);
        if (nazwaPasuje(nazwaPliku, pattern)) {
          wyniki.push(sciezka);
          if (wyniki.length >= limit) break;
        }
      }
      const podsumowanie = `Znaleziono ${wyniki.length} plik(ów)${wyniki.length >= limit ? ' (osiągnięto limit)' : ''}.`;
      return { content: [{ type: 'text', text: [podsumowanie, ...wyniki].join('\n') }] };
    } catch (blad) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Błąd wyszukiwania: ${blad instanceof Error ? blad.message : String(blad)}` }],
      };
    }
  },
);

serwer.registerTool(
  'search_file_contents',
  {
    title: 'Szukaj tekstu w plikach',
    description:
      'Przeszukuje rekurencyjnie pliki tekstowe we wskazanym katalogu i zwraca linie zawierające podany tekst ' +
      '(dopasowanie bez rozróżniania wielkości liter). Pomija pliki większe niż 5 MB i katalogi typu node_modules.',
    inputSchema: {
      directory: z.string().describe('Katalog startowy przeszukiwania'),
      query: z.string().min(1).describe('Szukany fragment tekstu'),
      extensions: z
        .array(z.string())
        .optional()
        .describe('Opcjonalna lista rozszerzeń do przeszukania, np. ["ts", "md"]'),
      maxResults: z.number().int().positive().max(MAKSYMALNY_LIMIT).optional(),
    },
  },
  async ({ directory, query, extensions, maxResults }) => {
    const limit = maxResults ?? DOMYSLNY_LIMIT;
    const queryLower = query.toLowerCase();
    const dozwoloneRozszerzenia = extensions?.map(e => e.toLowerCase().replace(/^\./, ''));
    try {
      const katalogBazowy = sprawdzKatalogBazowy(directory);
      const wyniki: string[] = [];
      for (const sciezka of przechodzKatalog(katalogBazowy)) {
        if (wyniki.length >= limit) break;
        if (dozwoloneRozszerzenia) {
          const kropka = sciezka.lastIndexOf('.');
          const rozszerzenie = kropka >= 0 ? sciezka.slice(kropka + 1).toLowerCase() : '';
          if (!dozwoloneRozszerzenia.includes(rozszerzenie)) continue;
        }
        let info;
        try {
          info = statSync(sciezka);
        } catch {
          continue;
        }
        if (info.size > ROZMIAR_LIMITU_PLIKU) continue;
        let zawartosc: string;
        try {
          zawartosc = readFileSync(sciezka, 'utf8');
        } catch {
          continue; // plik binarny albo brak dostępu
        }
        const linie = zawartosc.split(/\r?\n/);
        for (let i = 0; i < linie.length; i++) {
          if (linie[i].toLowerCase().includes(queryLower)) {
            wyniki.push(`${sciezka}:${i + 1}: ${linie[i].trim()}`);
            if (wyniki.length >= limit) break;
          }
        }
      }
      const podsumowanie = `Znaleziono ${wyniki.length} dopasowanie/a${wyniki.length >= limit ? ' (osiągnięto limit)' : ''}.`;
      return { content: [{ type: 'text', text: [podsumowanie, ...wyniki].join('\n') }] };
    } catch (blad) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Błąd wyszukiwania: ${blad instanceof Error ? blad.message : String(blad)}` }],
      };
    }
  },
);

const transport = new StdioServerTransport();
await serwer.connect(transport);

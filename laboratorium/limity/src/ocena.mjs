const STATUSY_WNIOSKU = new Set(['oczekuje', 'zatwierdzony', 'odrzucony', 'cofniety']);

function sprawdzKwote(wartosc, nazwa) {
  if (typeof wartosc !== 'number' || !Number.isInteger(wartosc) || wartosc < 0) {
    throw new Error(`Niepoprawna kwota "${nazwa}": oczekiwano nieujemnej liczby calkowitej w groszach.`);
  }
}

function sparsujCzasUtc(wartosc, nazwa) {
  if (typeof wartosc !== 'string' || !wartosc.endsWith('Z')) {
    throw new Error(`Niepoprawny format czasu "${nazwa}": oczekiwano ISO 8601 UTC zakonczonego na "Z".`);
  }
  const ms = Date.parse(wartosc);
  if (Number.isNaN(ms)) {
    throw new Error(`Niepoprawny format czasu "${nazwa}": nie udalo sie sparsowac wartosci "${wartosc}".`);
  }
  return ms;
}

function sprawdzTozsamosc(wartosc, nazwa) {
  if (typeof wartosc !== 'string' || wartosc.trim() === '') {
    throw new Error(`Pole "${nazwa}" musi byc niepustym identyfikatorem.`);
  }
}

export function ocenLimit(wejscie) {
  const { limitBazowyGrosze, wykorzystanieGrosze, teraz, wniosek } = wejscie;

  sprawdzKwote(limitBazowyGrosze, 'limitBazowyGrosze');
  sprawdzKwote(wykorzystanieGrosze, 'wykorzystanieGrosze');
  const terazMs = sparsujCzasUtc(teraz, 'teraz');

  if (wniosek) {
    sprawdzKwote(wniosek.limitGrosze, 'wniosek.limitGrosze');
    sprawdzTozsamosc(wniosek.autor, 'wniosek.autor');
    if (!STATUSY_WNIOSKU.has(wniosek.status)) {
      throw new Error(`Nieznany status wniosku: "${wniosek.status}".`);
    }
    if (wniosek.status === 'zatwierdzony') {
      sprawdzTozsamosc(wniosek.zatwierdzil, 'wniosek.zatwierdzil');
      if (wniosek.zatwierdzil === wniosek.autor) {
        throw new Error('Autor i zatwierdzajacy musza byc roznymi osobami dla zgody.');
      }
    }
    const odMs = sparsujCzasUtc(wniosek.od, 'wniosek.od');
    const doMs = sparsujCzasUtc(wniosek.do, 'wniosek.do');
    if (odMs >= doMs) {
      throw new Error('Okres wniosku jest niepoprawny: "od" musi byc wczesniejsze niz "do".');
    }

    const wObowiazywaniu = terazMs >= odMs && terazMs < doMs;
    if (wniosek.status === 'zatwierdzony' && wObowiazywaniu && wniosek.limitGrosze > limitBazowyGrosze) {
      return {
        limitEfektywnyGrosze: wniosek.limitGrosze,
        przekroczenieGrosze: Math.max(0, wykorzystanieGrosze - wniosek.limitGrosze),
        zrodlo: 'czasowy',
        wniosekId: wniosek.id,
      };
    }
  }

  return {
    limitEfektywnyGrosze: limitBazowyGrosze,
    przekroczenieGrosze: Math.max(0, wykorzystanieGrosze - limitBazowyGrosze),
    zrodlo: 'bazowy',
    wniosekId: null,
  };
}

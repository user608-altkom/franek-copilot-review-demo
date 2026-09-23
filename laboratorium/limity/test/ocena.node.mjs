import test from 'node:test';
import assert from 'node:assert/strict';
import { ocenLimit } from '../src/ocena.mjs';

test('bez wniosku: wykorzystanie 120 zl przy bazie 100 zl przekracza limit o 20 zl', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z', wniosek: null,
  };
  assert.deepEqual(ocenLimit(wejscie), {
    limitEfektywnyGrosze: 10000, przekroczenieGrosze: 2000,
    zrodlo: 'bazowy', wniosekId: null,
  });
});

test('zatwierdzony wniosek 15000 przy bazie 10000 i wykorzystaniu 12000 obowiazuje o 09:00Z', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: 'operator-2',
      status: 'zatwierdzony', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
    },
  };
  assert.deepEqual(ocenLimit(wejscie), {
    limitEfektywnyGrosze: 15000, przekroczenieGrosze: 0,
    zrodlo: 'czasowy', wniosekId: 'W-001',
  });
});

test('zatwierdzony wniosek obowiazuje dokladnie od momentu "od" (poczatek wlaczony)', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T08:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: 'operator-2',
      status: 'zatwierdzony', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
    },
  };
  assert.deepEqual(ocenLimit(wejscie), {
    limitEfektywnyGrosze: 15000, przekroczenieGrosze: 0,
    zrodlo: 'czasowy', wniosekId: 'W-001',
  });
});

test('zatwierdzony wniosek juz nie obowiazuje dokladnie w momencie "do" (koniec wylaczony)', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T10:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: 'operator-2',
      status: 'zatwierdzony', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
    },
  };
  assert.deepEqual(ocenLimit(wejscie), {
    limitEfektywnyGrosze: 10000, przekroczenieGrosze: 2000,
    zrodlo: 'bazowy', wniosekId: null,
  });
});

for (const status of ['oczekuje', 'odrzucony', 'cofniety']) {
  test(`wniosek w statusie "${status}" nie obowiazuje mimo trwajacego okresu`, () => {
    const wejscie = {
      kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
      teraz: '2026-09-22T09:00:00Z',
      wniosek: {
        id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: 'operator-2',
        status, od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
      },
    };
    assert.deepEqual(ocenLimit(wejscie), {
      limitEfektywnyGrosze: 10000, przekroczenieGrosze: 2000,
      zrodlo: 'bazowy', wniosekId: null,
    });
  });
}

test('limit bazowy zero jest prawidlowy i bez wniosku daje przekroczenie rowne wykorzystaniu', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 0, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z', wniosek: null,
  };
  assert.deepEqual(ocenLimit(wejscie), {
    limitEfektywnyGrosze: 0, przekroczenieGrosze: 12000,
    zrodlo: 'bazowy', wniosekId: null,
  });
});

test('autor i zatwierdzajacy to ta sama osoba: jawny blad, bez cichej zamiany na zgode', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: 'operator-1',
      status: 'zatwierdzony', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
    },
  };
  assert.throws(() => ocenLimit(wejscie));
});

for (const limitGrosze of [10000, 9000]) {
  test(`zatwierdzony wniosek z limitem ${limitGrosze} (<= bazy 10000) nie podnosi limitu`, () => {
    const wejscie = {
      kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
      teraz: '2026-09-22T09:00:00Z',
      wniosek: {
        id: 'W-001', limitGrosze, autor: 'operator-1', zatwierdzil: 'operator-2',
        status: 'zatwierdzony', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
      },
    };
    assert.deepEqual(ocenLimit(wejscie), {
      limitEfektywnyGrosze: 10000, przekroczenieGrosze: 2000,
      zrodlo: 'bazowy', wniosekId: null,
    });
  });
}

test('ujemna kwota bazowa daje jawny blad', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: -100, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z', wniosek: null,
  };
  assert.throws(() => ocenLimit(wejscie));
});

test('nie-calkowita kwota wykorzystania daje jawny blad', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 100.5,
    teraz: '2026-09-22T09:00:00Z', wniosek: null,
  };
  assert.throws(() => ocenLimit(wejscie));
});

// Dowod z review (pkt 3): walidacja kwot dziala tylko wewnatrz `if (wniosek && status === 'zatwierdzony')`,
// wiec ujemna kwota bazowa umyka bledowi takze wtedy, gdy wniosek istnieje, ale ma inny status.
test('ujemna kwota bazowa nadal nie daje bledu, gdy wniosek istnieje ale ma status inny niz zatwierdzony', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: -100, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: 'operator-2',
      status: 'oczekuje', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
    },
  };
  assert.throws(() => ocenLimit(wejscie));
});

test('nieznany status wniosku daje jawny blad', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: 'operator-2',
      status: 'anulowany', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
    },
  };
  assert.throws(() => ocenLimit(wejscie));
});

test('pusty zatwierdzajacy przy statusie zatwierdzony daje jawny blad', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: '',
      status: 'zatwierdzony', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
    },
  };
  assert.throws(() => ocenLimit(wejscie));
});

test('brak zatwierdzajacego jest dozwolony przy statusie innym niz zatwierdzony', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: null,
      status: 'oczekuje', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
    },
  };
  assert.deepEqual(ocenLimit(wejscie), {
    limitEfektywnyGrosze: 10000, przekroczenieGrosze: 2000,
    zrodlo: 'bazowy', wniosekId: null,
  });
});

test('niepoprawny format czasu "teraz" daje jawny blad', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22 09:00:00', wniosek: null,
  };
  assert.throws(() => ocenLimit(wejscie));
});

test('okres wniosku z "od" >= "do" daje jawny blad', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: 'operator-2',
      status: 'zatwierdzony', od: '2026-09-22T10:00:00Z', do: '2026-09-22T08:00:00Z',
    },
  };
  assert.throws(() => ocenLimit(wejscie));
});

test('ocenLimit nie zmienia danych wejsciowych', () => {
  const wejscie = {
    kontrahent: 'K-001', limitBazowyGrosze: 10000, wykorzystanieGrosze: 12000,
    teraz: '2026-09-22T09:00:00Z',
    wniosek: {
      id: 'W-001', limitGrosze: 15000, autor: 'operator-1', zatwierdzil: 'operator-2',
      status: 'zatwierdzony', od: '2026-09-22T08:00:00Z', do: '2026-09-22T10:00:00Z',
    },
  };
  const kopia = structuredClone(wejscie);
  ocenLimit(wejscie);
  assert.deepEqual(wejscie, kopia);
});

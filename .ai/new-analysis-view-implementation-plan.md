# Plan implementacji widoku Nowa Analiza

## 1. Przegląd

Widok "Nowa analiza" służy do tworzenia nowych analiz diffu git z automatycznym generowaniem opisu przez AI. Użytkownik wkleja diff, uzupełnia metadane (nazwa PR, branch, opcjonalnie ticket ID), a następnie system generuje trzy sekcje: podsumowanie zmian, listę ryzyk oraz plan testów. Po wygenerowaniu wyników użytkownik może je przejrzeć, opcjonalnie edytować, a następnie zapisać do historii.

Główne funkcjonalności:
- Formularz z polami metadanych i polem diff
- Walidacja limitu 1000 linii z licznikiem w czasie rzeczywistym
- Generowanie opisu AI z obsługą stanu ładowania (do 60s)
- Wyświetlanie wyników w trzech kartach (Podsumowanie, Ryzyka, Plan Testu)
- Zapis analizy do bazy danych
- Kopiowanie wszystkich wyników do schowka
- Obsługa błędów z możliwością retry

## 2. Routing widoku

| Właściwość | Wartość |
|------------|---------|
| Ścieżka | `/analysis/new` |
| Plik strony | `src/pages/analysis/new.astro` |
| Autoryzacja | Wymagana (middleware przekierowuje na `/login`) |
| Tryb renderowania | SSR (prerender = false) |

## 3. Struktura komponentów

```
AnalysisNewPage (Astro)
└── PageLayout
    └── AnalysisFormContainer (React, client:load)
        ├── MetadataFields
        │   ├── Input (PR Name)
        │   ├── Input (Branch Name)
        │   └── Input (Ticket ID - opcjonalne)
        ├── DiffInput
        │   ├── Textarea
        │   └── LineCounter
        ├── ActionButtons
        │   ├── Button (Generuj)
        │   ├── Button (Zapisz) - po wygenerowaniu
        │   └── Button (Kopiuj wszystko) - po wygenerowaniu
        ├── AiLoader (warunkowo)
        └── ResultsSection (warunkowo)
            ├── ResultCard (Podsumowanie)
            ├── ResultCard (Ryzyka)
            └── ResultCard (Plan Testu)
```

## 4. Szczegóły komponentów

### 4.1. AnalysisFormContainer

**Opis:** Główny kontener formularza zarządzający całym stanem widoku. Orkiestruje komunikację między komponentami potomnymi i obsługuje wywołania API.

**Główne elementy:**
- `<form>` z obsługą `onSubmit`
- Komponenty potomne: `MetadataFields`, `DiffInput`, `ActionButtons`, `AiLoader`, `ResultsSection`
- Toast (Sonner) do powiadomień

**Obsługiwane interakcje:**
- `onSubmit` - walidacja i wysłanie do API
- `onGenerate` - inicjacja generowania AI
- `onSave` - zapis analizy (PUT /api/analysis/:id)
- `onCopyAll` - kopiowanie wyników do schowka
- `beforeunload` - ostrzeżenie przy niezapisanych zmianach

**Obsługiwana walidacja:**
- Walidacja całego formularza przez schemat Zod przed wysłaniem
- Sprawdzenie czy wyniki AI są dostępne przed zapisem

**Typy:**
- `AnalysisFormState` (ViewModel)
- `CreateAnalysisCommand` (Request)
- `CreateAnalysisResponseDTO` (Response)

**Propsy:**
- Brak (komponent najwyższego poziomu)

**Lokalizacja:** `src/components/analysis/AnalysisFormContainer.tsx`

---

### 4.2. MetadataFields

**Opis:** Grupa pól formularza dla metadanych analizy: nazwa PR, nazwa brancha i opcjonalny identyfikator ticketa.

**Główne elementy:**
- 3x `<div>` z `<Label>` + `<Input>` (shadcn/ui)
- `<Alert>` dla błędów walidacji inline (opcjonalnie)

**Obsługiwane interakcje:**
- `onChange` dla każdego pola - aktualizacja stanu rodzica
- `onBlur` - walidacja pojedynczego pola

**Obsługiwana walidacja:**
- `pr_name`: wymagane, niepuste po trim
- `branch_name`: wymagane, niepuste po trim, max 255 znaków
- `ticket_id`: opcjonalne, max 255 znaków

**Typy:**
- `MetadataFieldsProps`
- `MetadataValues`

**Propsy:**
```typescript
interface MetadataFieldsProps {
  values: MetadataValues;
  errors: MetadataErrors;
  disabled: boolean;
  onChange: (field: keyof MetadataValues, value: string) => void;
}
```

**Lokalizacja:** `src/components/analysis/MetadataFields.tsx`

---

### 4.3. DiffInput

**Opis:** Pole tekstowe dla zawartości diffu git z licznikiem linii wyświetlanym pod polem. Font monospace dla lepszej czytelności kodu.

**Główne elementy:**
- `<Label>` z gwiazdką wymagalności
- `<Textarea>` (shadcn/ui) ze stylami monospace
- `<div>` z licznikiem linii i limitem
- `<Alert>` dla błędu przekroczenia limitu lub nieprawidłowego formatu

**Obsługiwane interakcje:**
- `onChange` - aktualizacja wartości i przeliczenie linii
- `onPaste` - obsługa wklejania diffu

**Obsługiwana walidacja:**
- Wymagane, niepuste
- Maksymalnie 1000 linii (licznik aktualizowany w czasie rzeczywistym)
- Format git diff (nagłówek diff + hunk markers @@)

**Typy:**
- `DiffInputProps`

**Propsy:**
```typescript
interface DiffInputProps {
  value: string;
  lineCount: number;
  error: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}
```

**Specyfikacja CSS:**
| Właściwość | Desktop | Tablet | Mobile |
|------------|---------|--------|--------|
| min-height | 300px | 250px | 200px |
| font-family | monospace | monospace | monospace |
| font-size | 13px | 13px | 13px |
| resize | vertical | vertical | vertical |

**Lokalizacja:** `src/components/analysis/DiffInput.tsx`

---

### 4.4. ActionButtons

**Opis:** Zestaw przycisków akcji kontekstowo zależny od stanu formularza. Wyświetla różne przyciski w zależności od tego, czy wyniki AI są już wygenerowane.

**Główne elementy:**
- `<Button>` Generuj (primary, ikona Sparkles)
- `<Button>` Zapisz (primary, ikona Save) - widoczny po wygenerowaniu
- `<Button>` Kopiuj wszystko (outline, ikona Copy) - widoczny po wygenerowaniu

**Obsługiwane interakcje:**
- `onGenerate` - kliknięcie przycisku Generuj
- `onSave` - kliknięcie przycisku Zapisz
- `onCopyAll` - kliknięcie przycisku Kopiuj wszystko

**Stany przycisków:**
| Przycisk | Warunek disabled | Tekst loading | Ikona loading |
|----------|------------------|---------------|---------------|
| Generuj | `isGenerating \|\| !isFormValid` | "Generowanie..." | Loader2 (animate-spin) |
| Zapisz | `isSaving \|\| !hasResults` | "Zapisywanie..." | Loader2 (animate-spin) |
| Kopiuj | `!hasResults` | - | - |

**Typy:**
- `ActionButtonsProps`

**Propsy:**
```typescript
interface ActionButtonsProps {
  isFormValid: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  hasResults: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onCopyAll: () => void;
}
```

**Lokalizacja:** `src/components/analysis/ActionButtons.tsx`

---

### 4.5. AiLoader

**Opis:** Pulsujący loader wyświetlany podczas generowania odpowiedzi AI. Informuje użytkownika o trwającym procesie i maksymalnym czasie oczekiwania.

**Główne elementy:**
- `<div>` jako overlay/kontener
- Ikona loadera z animacją pulse
- Tekst "Analizuję zmiany..."
- Tekst pomocniczy "Może to potrwać do 60 sekund"

**Obsługiwane interakcje:**
- Brak (komponent prezentacyjny)

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `AiLoaderProps` (opcjonalnie, jeśli potrzebne warianty)

**Propsy:**
```typescript
interface AiLoaderProps {
  message?: string;
}
```

**Atrybuty dostępności:**
- `aria-busy="true"` na kontenerze formularza podczas ładowania
- `role="status"` na komponencie loader
- `aria-live="polite"` dla komunikatów

**Lokalizacja:** `src/components/analysis/AiLoader.tsx`

---

### 4.6. ResultsSection

**Opis:** Kontener wyświetlający trzy karty z wynikami wygenerowanymi przez AI. Renderowany warunkowo po otrzymaniu odpowiedzi.

**Główne elementy:**
- `<div>` jako kontener z układem pionowym
- 3x `<ResultCard>` dla sekcji: Podsumowanie, Ryzyka, Plan Testu

**Obsługiwane interakcje:**
- Delegacja `onEdit` do poszczególnych kart (opcjonalne w MVP)

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `ResultsSectionProps`
- `AIResponse`

**Propsy:**
```typescript
interface ResultsSectionProps {
  aiResponse: AIResponse;
  isEditable?: boolean;
  onEdit?: (field: keyof AIResponse, value: string) => void;
}
```

**Lokalizacja:** `src/components/analysis/ResultsSection.tsx`

---

### 4.7. ResultCard

**Opis:** Pojedyncza karta wyświetlająca jedną sekcję wyniku AI (podsumowanie, ryzyka lub plan testów). Używa komponentu Card z shadcn/ui.

**Główne elementy:**
- `<Card>` (shadcn/ui)
  - `<CardHeader>` z tytułem sekcji
  - `<CardContent>` z renderowanym markdown lub textarea do edycji

**Obsługiwane interakcje:**
- Kliknięcie do przełączenia trybu edycji (opcjonalne w MVP)
- `onChange` przy edycji treści

**Obsługiwana walidacja:**
- Treść nie może być pusta (przy edycji)

**Typy:**
- `ResultCardProps`

**Propsy:**
```typescript
interface ResultCardProps {
  title: string;
  content: string;
  isEditable?: boolean;
  onEdit?: (value: string) => void;
}
```

**Lokalizacja:** `src/components/analysis/ResultCard.tsx`

---

## 5. Typy

### 5.1. Typy żądań i odpowiedzi API (istniejące w `src/types.ts`)

```typescript
// Command model dla POST /api/analysis
interface CreateAnalysisCommand {
  pr_name: string;
  branch_name: string;
  ticket_id?: string;
  diff_content: string;
}

// Odpowiedź z POST /api/analysis
interface CreateAnalysisResponseDTO {
  data: {
    id: string;                    // UUID
    status: StatusDTO;             // { id: 1, code: "draft" }
    ai_response: AIResponse;       // Wygenerowane przez AI
    created_at: string;            // ISO8601
  };
}

// Struktura odpowiedzi AI
interface AIResponse {
  summary: string;  // Markdown
  risks: string;    // Markdown
  tests: string;    // Markdown
}

// Command model dla PUT /api/analysis/:id
interface UpdateAnalysisCommand {
  pr_name: string;
  ai_response: AIResponse;
  status_id: number;
  ticket_id?: string;
}

// Błąd walidacji
interface ValidationErrorResponse {
  error: string;
  field_errors?: Record<string, string[]>;
  status_code: number;
}
```

### 5.2. Nowe typy ViewModel (do stworzenia)

```typescript
// Stan formularza metadanych
interface MetadataValues {
  pr_name: string;
  branch_name: string;
  ticket_id: string;
}

// Błędy walidacji metadanych
interface MetadataErrors {
  pr_name: string | null;
  branch_name: string | null;
  ticket_id: string | null;
}

// Główny stan formularza
interface AnalysisFormState {
  // Dane formularza
  metadata: MetadataValues;
  diffContent: string;
  
  // Wyniki AI
  aiResponse: AIResponse | null;
  analysisId: string | null;
  
  // Stany UI
  isGenerating: boolean;
  isSaving: boolean;
  isDirty: boolean;
  
  // Błędy
  metadataErrors: MetadataErrors;
  diffError: string | null;
  apiError: string | null;
}

// Wynik walidacji formularza
interface FormValidationResult {
  isValid: boolean;
  errors: {
    metadata: MetadataErrors;
    diff: string | null;
  };
}
```

### 5.3. Typy propsów komponentów

```typescript
interface MetadataFieldsProps {
  values: MetadataValues;
  errors: MetadataErrors;
  disabled: boolean;
  onChange: (field: keyof MetadataValues, value: string) => void;
}

interface DiffInputProps {
  value: string;
  lineCount: number;
  error: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}

interface ActionButtonsProps {
  isFormValid: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  hasResults: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onCopyAll: () => void;
}

interface AiLoaderProps {
  message?: string;
}

interface ResultsSectionProps {
  aiResponse: AIResponse;
  isEditable?: boolean;
  onEdit?: (field: keyof AIResponse, value: string) => void;
}

interface ResultCardProps {
  title: string;
  content: string;
  isEditable?: boolean;
  onEdit?: (value: string) => void;
}
```

## 6. Zarządzanie stanem

### 6.1. Custom Hook: `useAnalysisForm`

Hook zarządzający całym stanem formularza analizy. Enkapsuluje logikę walidacji, komunikacji z API i zarządzania stanami UI.

**Lokalizacja:** `src/components/analysis/hooks/useAnalysisForm.ts`

```typescript
interface UseAnalysisFormReturn {
  // Stan
  state: AnalysisFormState;
  lineCount: number;
  isFormValid: boolean;
  
  // Akcje metadanych
  updateMetadata: (field: keyof MetadataValues, value: string) => void;
  
  // Akcje diff
  updateDiffContent: (value: string) => void;
  
  // Akcje główne
  handleGenerate: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleCopyAll: () => Promise<void>;
  
  // Edycja wyników (opcjonalne)
  updateAiResponse: (field: keyof AIResponse, value: string) => void;
  
  // Reset
  resetForm: () => void;
}
```

**Wewnętrzna logika:**
1. `useState` dla `AnalysisFormState`
2. `useMemo` dla `lineCount` (obliczany z `diffContent.split('\n').length`)
3. `useMemo` dla `isFormValid` (na podstawie walidacji Zod)
4. `useEffect` dla `beforeunload` listener gdy `isDirty === true`
5. Funkcje async dla operacji API z obsługą błędów

### 6.2. Przepływ stanu

```
┌─────────────────────────────────────────────────────────────────┐
│                    AnalysisFormContainer                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               useAnalysisForm (hook)                     │   │
│  │                                                          │   │
│  │  state: AnalysisFormState                               │   │
│  │    ├── metadata (MetadataValues)                        │   │
│  │    ├── diffContent (string)                             │   │
│  │    ├── aiResponse (AIResponse | null)                   │   │
│  │    ├── analysisId (string | null)                       │   │
│  │    ├── isGenerating, isSaving, isDirty (boolean)        │   │
│  │    └── errors (MetadataErrors, diffError, apiError)     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│     ┌─────────────────────┼─────────────────────┐              │
│     ▼                     ▼                     ▼              │
│  MetadataFields      DiffInput           ActionButtons         │
│  (values, errors,    (value, lineCount,  (isFormValid,        │
│   onChange)           error, onChange)    callbacks)           │
│                                                                 │
│     ┌─────────────────────────────────────────┐                │
│     ▼                                         ▼                │
│  AiLoader                              ResultsSection          │
│  (gdy isGenerating)                    (gdy aiResponse)        │
└─────────────────────────────────────────────────────────────────┘
```

## 7. Integracja API

### 7.1. POST /api/analysis - Tworzenie analizy i generowanie AI

**Wywołanie:**
```typescript
const response = await fetch('/api/analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // dla cookie sesji
  body: JSON.stringify({
    pr_name: metadata.pr_name.trim(),
    branch_name: metadata.branch_name.trim(),
    ticket_id: metadata.ticket_id?.trim() || undefined,
    diff_content: diffContent,
  } satisfies CreateAnalysisCommand),
});
```

**Odpowiedź sukcesu (201):**
```typescript
interface CreateAnalysisResponseDTO {
  data: {
    id: string;
    status: { id: 1, code: "draft" };
    ai_response: {
      summary: string;
      risks: string;
      tests: string;
    };
    created_at: string;
  };
}
```

**Obsługa błędów:**
| Status | Znaczenie | Akcja UI |
|--------|-----------|----------|
| 400 | Błąd walidacji | Wyświetl błędy przy polach |
| 401 | Brak autoryzacji | Przekierowanie na `/login` |
| 429 | Rate limit | Toast z komunikatem |
| 502 | Błąd AI | Toast + przycisk retry |
| 503 | AI niedostępne | Toast z komunikatem |
| 504 | Timeout AI | Toast + przycisk retry |

### 7.2. PUT /api/analysis/:id - Zapisanie analizy

**Wywołanie:**
```typescript
const response = await fetch(`/api/analysis/${analysisId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({
    pr_name: metadata.pr_name.trim(),
    ai_response: aiResponse,
    status_id: 2, // pending_review
    ticket_id: metadata.ticket_id?.trim() || undefined,
  } satisfies UpdateAnalysisCommand),
});
```

**Odpowiedź sukcesu (200):**
```typescript
interface AnalysisResponseDTO {
  data: AnalysisDTO;
}
```

## 8. Interakcje użytkownika

### 8.1. Wypełnianie formularza

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Wpisanie tekstu w PR Name | Input | Aktualizacja stanu, walidacja inline |
| Wpisanie tekstu w Branch | Input | Aktualizacja stanu, walidacja inline |
| Wpisanie/wklejenie w Ticket ID | Input | Aktualizacja stanu (opcjonalne) |
| Wklejenie diffu | Textarea | Aktualizacja stanu, przeliczenie linii, walidacja formatu |
| Edycja diffu | Textarea | Aktualizacja licznika linii w czasie rzeczywistym |

### 8.2. Generowanie analizy

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Kliknięcie "Generuj" | Button | Walidacja → Loader → Request API → Wyświetlenie wyników lub błędu |
| Przekroczenie 1000 linii | DiffInput | Blokada przycisku, komunikat błędu |
| Nieprawidłowy format diff | DiffInput | Blokada przycisku, komunikat o wymaganym formacie |

### 8.3. Zapis i kopiowanie

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Kliknięcie "Zapisz" | Button | Request PUT → Toast "Zapisano" → Przekierowanie na `/analysis/:id` |
| Kliknięcie "Kopiuj wszystko" | Button | Skopiowanie do schowka → Toast "Skopiowano" |

### 8.4. Nawigacja i ochrona danych

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Próba zamknięcia karty z niezapisanymi zmianami | Browser | Dialog `beforeunload` |
| Nawigacja wewnątrz SPA z niezapisanymi zmianami | Link/Button | AlertDialog z pytaniem |

## 9. Warunki i walidacja

### 9.1. Walidacja pól formularza

| Pole | Warunek | Komunikat błędu | Komponent |
|------|---------|-----------------|-----------|
| PR Name | Wymagane | "Nazwa PR jest wymagana" | MetadataFields |
| PR Name | Niepuste po trim | "Nazwa PR nie może być pusta" | MetadataFields |
| Branch Name | Wymagane | "Nazwa brancha jest wymagana" | MetadataFields |
| Branch Name | Niepuste po trim | "Nazwa brancha nie może być pusta" | MetadataFields |
| Branch Name | Max 255 znaków | "Nazwa brancha może mieć max 255 znaków" | MetadataFields |
| Ticket ID | Max 255 znaków | "ID ticketa może mieć max 255 znaków" | MetadataFields |
| Diff Content | Wymagane | "Diff jest wymagany" | DiffInput |
| Diff Content | Max 1000 linii | "Diff przekracza limit 1000 linii (obecnie: X)" | DiffInput |
| Diff Content | Format git diff | "Nieprawidłowy format git diff" | DiffInput |

### 9.2. Walidacja formatu git diff

Diff musi zawierać:
- Nagłówek `diff --git` LUB `---` (unified diff)
- Markery hunków `@@ ... @@`

### 9.3. Wpływ walidacji na UI

| Stan walidacji | Wpływ na UI |
|----------------|-------------|
| Błąd w polu | Czerwona ramka, komunikat pod polem |
| Przekroczony limit linii | Licznik w kolorze czerwonym, przycisk disabled |
| Formularz niepoprawny | Przycisk "Generuj" disabled |
| Brak wyników AI | Przycisk "Zapisz" i "Kopiuj" ukryte |

## 10. Obsługa błędów

### 10.1. Błędy walidacji (400)

```typescript
if (response.status === 400) {
  const errorData: ValidationErrorResponse = await response.json();
  
  if (errorData.field_errors) {
    // Mapowanie błędów na pola formularza
    setMetadataErrors({
      pr_name: errorData.field_errors.pr_name?.[0] || null,
      branch_name: errorData.field_errors.branch_name?.[0] || null,
      ticket_id: errorData.field_errors.ticket_id?.[0] || null,
    });
    setDiffError(errorData.field_errors.diff_content?.[0] || null);
  }
}
```

### 10.2. Błędy autoryzacji (401)

```typescript
if (response.status === 401) {
  toast.error('Sesja wygasła. Zaloguj się ponownie.');
  window.location.href = '/login';
}
```

### 10.3. Błędy serwisu AI (502, 503, 504)

```typescript
const AI_ERROR_MESSAGES: Record<number, string> = {
  502: 'Błąd podczas generowania AI. Spróbuj ponownie.',
  503: 'Serwis AI jest tymczasowo niedostępny.',
  504: 'Przekroczono czas oczekiwania na odpowiedź AI (60s).',
};

if ([502, 503, 504].includes(response.status)) {
  toast.error(AI_ERROR_MESSAGES[response.status], {
    action: {
      label: 'Spróbuj ponownie',
      onClick: () => handleGenerate(),
    },
  });
}
```

### 10.4. Rate limiting (429)

```typescript
if (response.status === 429) {
  toast.error('Zbyt wiele żądań. Poczekaj chwilę przed ponowną próbą.');
}
```

### 10.5. Błędy sieciowe

```typescript
try {
  const response = await fetch(...);
  // ...
} catch (error) {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    toast.error('Brak połączenia z serwerem. Sprawdź połączenie internetowe.');
  } else {
    toast.error('Wystąpił nieoczekiwany błąd.');
  }
}
```

## 11. Kroki implementacji

### Krok 1: Utworzenie strony Astro

1. Utworzyć plik `src/pages/analysis/new.astro`
2. Zaimportować `PageLayout` i `AnalysisFormContainer`
3. Dodać odpowiednie meta tagi (title: "Nowa analiza")
4. Ustawić `export const prerender = false;`

### Krok 2: Implementacja typów ViewModel

1. Utworzyć plik `src/components/analysis/types.ts`
2. Zdefiniować interfejsy: `MetadataValues`, `MetadataErrors`, `AnalysisFormState`
3. Zdefiniować interfejsy propsów wszystkich komponentów

### Krok 3: Implementacja komponentów UI (bottom-up)

1. **AiLoader** - prosty komponent prezentacyjny z animacją
2. **ResultCard** - karta z tytułem i treścią markdown
3. **ResultsSection** - kontener na 3 karty
4. **DiffInput** - textarea z licznikiem linii
5. **MetadataFields** - grupa pól formularza
6. **ActionButtons** - przyciski z obsługą stanów loading

### Krok 4: Implementacja custom hooka

1. Utworzyć `src/components/analysis/hooks/useAnalysisForm.ts`
2. Zaimplementować zarządzanie stanem formularza
3. Dodać funkcje walidacji z użyciem schematu Zod
4. Zaimplementować funkcje API: `handleGenerate`, `handleSave`, `handleCopyAll`
5. Dodać efekt `beforeunload` dla ochrony niezapisanych zmian

### Krok 5: Implementacja głównego kontenera

1. Utworzyć `src/components/analysis/AnalysisFormContainer.tsx`
2. Połączyć hook z komponentami potomnymi
3. Dodać obsługę toast notifications (Sonner)
4. Zaimplementować warunkowe renderowanie (loader, wyniki)

### Krok 6: Stylowanie i responsywność

1. Dodać klasy Tailwind dla responsywności (min-height dla DiffInput)
2. Sprawdzić układ na breakpointach: desktop, tablet, mobile
3. Upewnić się, że font monospace jest stosowany w DiffInput

### Krok 7: Dostępność

1. Dodać etykiety `<Label>` powiązane z polami przez `htmlFor`
2. Dodać `aria-required="true"` dla wymaganych pól
3. Dodać `aria-describedby` dla komunikatów błędów
4. Dodać `aria-busy` na kontenerze podczas ładowania
5. Przetestować nawigację klawiaturą (Tab, Enter)

### Krok 8: Integracja z istniejącymi komponentami

1. Upewnić się, że `Navbar` zawiera link "Nowa analiza" → `/analysis/new`
2. Dodać obsługę przekierowania po zapisie na `/analysis/:id`

### Krok 9: Testy manualne

1. Przetestować flow tworzenia analizy od początku do końca
2. Sprawdzić walidację wszystkich pól
3. Przetestować scenariusze błędów (timeout, 503, itp.)
4. Sprawdzić funkcję kopiowania do schowka
5. Przetestować ostrzeżenie `beforeunload`

### Krok 10: Refaktoryzacja i code review

1. Przejrzeć kod pod kątem best practices
2. Upewnić się, że wszystkie typy są poprawnie zdefiniowane
3. Sprawdzić obsługę błędów edge cases
4. Zoptymalizować re-rendery (useMemo, useCallback gdzie potrzebne)

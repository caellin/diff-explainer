# Plan implementacji widoku Szczegóły analizy

## 1. Przegląd

Widok "Szczegóły analizy" służy do przeglądania, edycji i zarządzania istniejącą analizą diffu git. Użytkownik może przejrzeć wszystkie dane analizy (metadane, diff, wyniki AI), edytować metadane i treść wyników AI, ponownie wygenerować opis AI, skopiować wyniki do schowka oraz usunąć analizę z historii.

Kluczową funkcjonalnością jest obsługa wyników AI w formacie markdown z możliwością przełączania między:
- **Trybem podglądu**: renderowany markdown do czytania
- **Trybem edycji**: textarea z surowym markdown do modyfikacji

Każda sekcja wyników AI (Podsumowanie, Ryzyka, Plan Testu) ma własny, niezależny przełącznik trybu.

Główne funkcjonalności:
- Wyświetlanie pełnych danych analizy (metadane, diff, wyniki AI)
- Edycja metadanych (PR Name, Branch Name, Ticket ID) - zawsze dostępna
- Przełączanie podgląd/edycja dla każdej sekcji wyników AI osobno
- Ponowne generowanie opisu AI bez utraty metadanych
- Ocena jakości analizy (QualityRating dropdown)
- Kopiowanie wszystkich wyników do schowka
- Usuwanie analizy z potwierdzeniem
- Skeleton loading podczas ładowania danych
- Obsługa błędów z możliwością retry

## 2. Routing widoku

| Właściwość | Wartość |
|------------|---------|
| Ścieżka | `/analysis/[id]` |
| Plik strony | `src/pages/analysis/[id].astro` |
| Autoryzacja | Wymagana (middleware przekierowuje na `/login`) |
| Tryb renderowania | SSR (prerender = false) |
| Parametr dynamiczny | `id` - UUID analizy |

## 3. Struktura komponentów

```
AnalysisDetailPage (Astro)
└── PageLayout
    └── AnalysisDetailContainer (React, client:load)
        ├── AnalysisDetailSkeleton (warunkowo - podczas ładowania)
        │
        ├── MetadataFields
        │   ├── Input (PR Name) - edytowalny
        │   ├── Input (Branch Name) - edytowalny
        │   └── Input (Ticket ID - opcjonalne) - edytowalny
        │
        ├── DiffDisplay
        │   └── <pre> z diff_content
        │
        ├── QualityRating
        │   └── Select (ocena jakości)
        │
        ├── ResultsSection
        │   ├── ResultCard (Podsumowanie)
        │   │   ├── Toggle (Podgląd / Edycja)
        │   │   ├── MarkdownPreview (tryb podglądu)
        │   │   └── Textarea (tryb edycji)
        │   ├── ResultCard (Ryzyka)
        │   │   └── [jak wyżej]
        │   └── ResultCard (Plan Testu)
        │       └── [jak wyżej]
        │
        ├── ActionButtons
        │   ├── Button (Zapisz)
        │   ├── Button (Generuj ponownie)
        │   ├── Button (Kopiuj wszystko)
        │   └── Button (Usuń)
        │
        ├── AiLoader (warunkowo - podczas generowania)
        │
        └── DeleteConfirmDialog
            └── AlertDialog z potwierdzeniem usunięcia
```

## 4. Szczegóły komponentów

### 4.1. AnalysisDetailContainer

**Opis:** Główny kontener widoku zarządzający całym stanem. Pobiera dane analizy przy montowaniu, orkiestruje komunikację między komponentami potomnymi i obsługuje wywołania API.

**Główne elementy:**
- Wrapper `<div>` z obsługą stanów ładowania
- Komponenty potomne: `MetadataFields`, `DiffDisplay`, `QualityRating`, `ResultsSection`, `ActionButtons`, `AiLoader`, `DeleteConfirmDialog`
- Toast (Sonner) do powiadomień

**Obsługiwane interakcje:**
- `onMount` - pobranie danych analizy (GET /api/analysis/:id)
- `onSave` - zapis zmian (PUT /api/analysis/:id)
- `onRegenerate` - ponowne generowanie AI (POST /api/analysis/:id/generate)
- `onCopyAll` - kopiowanie wyników do schowka
- `onDelete` - usunięcie analizy (DELETE /api/analysis)
- `beforeunload` - ostrzeżenie przy niezapisanych zmianach

**Obsługiwana walidacja:**
- Walidacja pól formularza przez schemat Zod przed zapisem
- Sprawdzenie czy wyniki AI nie są puste przed zapisem

**Typy:**
- `AnalysisDetailState` (ViewModel)
- `AnalysisDTO` (Response z API)
- `UpdateAnalysisCommand` (Request)

**Propsy:**
```typescript
interface AnalysisDetailContainerProps {
  analysisId: string;
}
```

**Lokalizacja:** `src/components/analysis/AnalysisDetailContainer.tsx`

---

### 4.2. AnalysisDetailSkeleton

**Opis:** Placeholder wyświetlany podczas ładowania danych analizy. Używa komponentu Skeleton z shadcn/ui do symulacji układu strony.

**Główne elementy:**
- `<Skeleton>` dla pól metadanych (3 prostokąty)
- `<Skeleton>` dla sekcji diff (większy prostokąt)
- `<Skeleton>` dla 3 kart wyników AI

**Obsługiwane interakcje:**
- Brak (komponent prezentacyjny)

**Obsługiwana walidacja:**
- Brak

**Typy:**
- Brak

**Propsy:**
- Brak

**Lokalizacja:** `src/components/analysis/AnalysisDetailSkeleton.tsx`

---

### 4.3. MetadataFields

**Opis:** Grupa pól formularza dla metadanych analizy. Wszystkie pola metadanych (PR Name, Branch Name, Ticket ID) są edytowalne podczas aktualizacji analizy.

**Główne elementy:**
- 3x `<div>` z `<Label>` + `<Input>` (shadcn/ui)
- `<Alert>` dla błędów walidacji inline

**Obsługiwane interakcje:**
- `onChange` dla pól `pr_name`, `branch_name` i `ticket_id`

**Obsługiwana walidacja:**
- `pr_name`: wymagane, niepuste po trim
- `branch_name`: wymagane, niepuste po trim, max 255 znaków
- `ticket_id`: opcjonalne, max 255 znaków

**Typy:**
- `MetadataFieldsProps`
- `MetadataValues`
- `MetadataErrors`

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

### 4.4. DiffDisplay

**Opis:** Komponent wyświetlający zawartość diffu git w trybie tylko do odczytu. Używa elementu `<pre>` z fontem monospace dla zachowania formatowania.

**Główne elementy:**
- `<Card>` (shadcn/ui) jako kontener
  - `<CardHeader>` z tytułem "Diff"
  - `<CardContent>` z `<pre>` zawierającym diff

**Obsługiwane interakcje:**
- Brak (tylko do odczytu)

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `DiffDisplayProps`

**Propsy:**
```typescript
interface DiffDisplayProps {
  content: string;
  maxHeight?: string;
}
```

**Specyfikacja CSS:**
| Właściwość | Wartość |
|------------|---------|
| font-family | monospace |
| font-size | 13px |
| max-height | 400px (z overflow-y: auto) |
| white-space | pre-wrap |
| word-break | break-all |
| background | gray-50 (lub dark mode odpowiednik) |

**Lokalizacja:** `src/components/analysis/DiffDisplay.tsx`

---

### 4.5. QualityRating

**Opis:** Dropdown do oceny jakości wygenerowanej analizy. Dostępny po pierwszym zapisie analizy (gdy status !== draft).

**Główne elementy:**
- `<Label>` z tekstem "Ocena jakości"
- `<Select>` (shadcn/ui) z opcjami:
  - Brak oceny (wartość pusta/null)
  - Zaakceptowana (status_id: 3)
  - Wymaga poprawek (status_id: 2)

**Obsługiwane interakcje:**
- `onChange` - zmiana oceny jakości

**Obsługiwana walidacja:**
- Wartość musi być jednym z dozwolonych status_id

**Typy:**
- `QualityRatingProps`

**Propsy:**
```typescript
interface QualityRatingProps {
  value: number | null;
  disabled: boolean;
  onChange: (statusId: number) => void;
}
```

**Lokalizacja:** `src/components/analysis/QualityRating.tsx`

---

### 4.6. ResultsSection

**Opis:** Kontener wyświetlający trzy karty z wynikami AI. Każda karta ma własny przełącznik między trybem podglądu (renderowany markdown) a trybem edycji (textarea).

**Główne elementy:**
- `<div>` jako kontener z układem pionowym
- 3x `<ResultCard>` dla sekcji: Podsumowanie, Ryzyka, Plan Testu

**Obsługiwane interakcje:**
- Delegacja `onEdit` do poszczególnych kart
- Delegacja `onToggleMode` do poszczególnych kart

**Obsługiwana walidacja:**
- Brak (walidacja na poziomie ResultCard)

**Typy:**
- `ResultsSectionProps`
- `AIResponse`
- `CardEditModes`

**Propsy:**
```typescript
interface ResultsSectionProps {
  aiResponse: AIResponse;
  editModes: CardEditModes;
  errors?: AIResponseErrors;
  onEdit: (field: keyof AIResponse, value: string) => void;
  onToggleMode: (field: keyof AIResponse) => void;
}
```

**Lokalizacja:** `src/components/analysis/ResultsSection.tsx`

---

### 4.7. ResultCard

**Opis:** Pojedyncza karta wyświetlająca jedną sekcję wyniku AI z możliwością przełączania między trybem podglądu (renderowany markdown) a trybem edycji (textarea z raw markdown).

**Główne elementy:**
- `<Card>` (shadcn/ui)
  - `<CardHeader>`:
    - Tytuł sekcji
    - Toggle button (ikona Eye/Edit) do przełączania trybu
  - `<CardContent>`:
    - **Tryb podglądu (`isEditMode: false`)**: 
      - Renderowany markdown (użyć biblioteki jak `react-markdown` lub prostego renderowania)
      - Formatowanie: nagłówki, listy, bold/italic, code blocks
    - **Tryb edycji (`isEditMode: true`)**: 
      - `<Textarea>` z surowym markdown
      - Font monospace dla lepszej czytelności kodu

**Obsługiwane interakcje:**
- `onToggleMode` - przełączanie między podglądem a edycją
- `onChange` - aktualizacja treści (tylko w trybie edycji)

**Obsługiwana walidacja:**
- Treść nie może być pusta (przy zapisie)

**Typy:**
- `ResultCardProps`

**Propsy:**
```typescript
interface ResultCardProps {
  title: string;
  content: string;
  isEditMode: boolean;
  error?: string | null;
  onEdit: (value: string) => void;
  onToggleMode: () => void;
}
```

**Specyfikacja toggle button:**
| Tryb | Ikona | Tooltip | aria-label |
|------|-------|---------|------------|
| Podgląd (preview) | Eye | "Podgląd markdown" | "Przełącz na podgląd" |
| Edycja (edit) | Edit2/Pencil | "Edytuj markdown" | "Przełącz na edycję" |

**Specyfikacja Textarea (tryb edycji):**
| Właściwość | Wartość |
|------------|---------|
| font-family | monospace |
| font-size | 13px |
| min-height | 150px |
| resize | vertical |

**Lokalizacja:** `src/components/analysis/ResultCard.tsx`

---

### 4.8. ActionButtons

**Opis:** Zestaw przycisków akcji dla widoku szczegółów analizy. Wszystkie przyciski są zawsze widoczne (nie zależą od trybu edycji kart).

**Główne elementy:**
- `<Button>` Zapisz (primary, ikona Save)
- `<Button>` Generuj ponownie (outline, ikona RefreshCw)
- `<Button>` Kopiuj wszystko (outline, ikona Copy)
- `<Button>` Usuń (destructive, ikona Trash2)

**Obsługiwane interakcje:**
- `onSave` - zapisanie zmian
- `onRegenerate` - ponowne generowanie AI
- `onCopyAll` - kopiowanie do schowka
- `onDelete` - otwarcie dialogu usuwania

**Stany przycisków:**
| Przycisk | Warunek disabled | Tekst loading | Ikona loading |
|----------|------------------|---------------|---------------|
| Zapisz | `isSaving \|\| !isFormValid \|\| !isDirty` | "Zapisywanie..." | Loader2 (animate-spin) |
| Generuj ponownie | `isRegenerating` | "Generowanie..." | Loader2 (animate-spin) |
| Usuń | `isDeleting` | "Usuwanie..." | Loader2 (animate-spin) |
| Kopiuj | `!hasResults` | - | - |

**Typy:**
- `ActionButtonsDetailProps`

**Propsy:**
```typescript
interface ActionButtonsDetailProps {
  isFormValid: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isRegenerating: boolean;
  isDeleting: boolean;
  hasResults: boolean;
  onSave: () => void;
  onRegenerate: () => void;
  onCopyAll: () => void;
  onDelete: () => void;
}
```

**Lokalizacja:** `src/components/analysis/ActionButtonsDetail.tsx`

---

### 4.9. DeleteConfirmDialog

**Opis:** Dialog potwierdzenia usunięcia analizy. Wyświetla nazwę PR dla jasności kontekstu.

**Główne elementy:**
- `<AlertDialog>` (shadcn/ui)
  - `<AlertDialogContent>`
    - `<AlertDialogHeader>` z tytułem "Usuń analizę"
    - `<AlertDialogDescription>` z tekstem zawierającym nazwę PR
    - `<AlertDialogFooter>`:
      - `<AlertDialogCancel>` Anuluj
      - `<AlertDialogAction>` Usuń (destructive)

**Obsługiwane interakcje:**
- `onConfirm` - potwierdzenie usunięcia
- `onCancel` - anulowanie (zamknięcie dialogu)

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `DeleteConfirmDialogProps`

**Propsy:**
```typescript
interface DeleteConfirmDialogProps {
  isOpen: boolean;
  prName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Atrybuty dostępności:**
- Focus trap wewnątrz dialogu
- `aria-labelledby` dla tytułu
- `aria-describedby` dla opisu
- Zamykanie przez Escape

**Lokalizacja:** `src/components/analysis/DeleteConfirmDialog.tsx`

---

### 4.10. AiLoader

**Opis:** Pulsujący loader wyświetlany podczas ponownego generowania odpowiedzi AI.

**Główne elementy:**
- `<div>` jako overlay/kontener
- Ikona loadera z animacją pulse
- Tekst "Generuję ponownie..."
- Tekst pomocniczy "Może to potrwać do 60 sekund"

**Obsługiwane interakcje:**
- Brak (komponent prezentacyjny)

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `AiLoaderProps`

**Propsy:**
```typescript
interface AiLoaderProps {
  message?: string;
}
```

**Lokalizacja:** `src/components/analysis/AiLoader.tsx` (istniejący, do współdzielenia)

---

## 5. Typy

### 5.1. Typy żądań i odpowiedzi API (istniejące w `src/types.ts`)

```typescript
// Odpowiedź z GET /api/analysis/:id
interface AnalysisResponseDTO {
  data: AnalysisDTO;
}

interface AnalysisDTO {
  id: string;                           // UUID
  pr_name: string;
  branch_name: string;
  diff_content: string;
  ai_response: AIResponse | EmptyAIResponse;
  status: StatusDTO;                    // { id: number, code: string }
  ticket_id: string | null;
  created_at: string;                   // ISO8601
  updated_at: string;                   // ISO8601
}

interface AIResponse {
  summary: string;
  risks: string;
  tests: string;
}

interface StatusDTO {
  id: number;
  code: string;
}

// Command model dla PUT /api/analysis/:id
interface UpdateAnalysisCommand {
  pr_name: string;
  branch_name: string;
  ai_response: AIResponse;
  status_id: number;
  ticket_id?: string;
}

// Odpowiedź z POST /api/analysis/:id/generate
interface GenerateAnalysisResponseDTO {
  data: AIResponse;
}

// Command model dla DELETE /api/analysis
interface DeleteAnalysesCommand {
  ids: string[];
}

// Odpowiedź z DELETE /api/analysis
interface DeleteAnalysesResponseDTO {
  deleted_count: number;
}
```

### 5.2. Nowe typy ViewModel (do stworzenia)

```typescript
// Stan trybu edycji dla każdej karty wyników AI
interface CardEditModes {
  summary: boolean;  // true = tryb edycji, false = tryb podglądu
  risks: boolean;
  tests: boolean;
}

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

// Błędy walidacji wyników AI
interface AIResponseErrors {
  summary: string | null;
  risks: string | null;
  tests: string | null;
}

// Główny stan widoku szczegółów
interface AnalysisDetailState {
  // Dane z API (źródło prawdy)
  analysis: AnalysisDTO | null;
  
  // Edytowane wartości (kopie do modyfikacji)
  editedMetadata: MetadataValues;
  editedAiResponse: AIResponse;
  editedStatusId: number;
  
  // Tryby edycji dla kart wyników AI
  cardEditModes: CardEditModes;
  
  // Stany UI
  isLoading: boolean;
  isSaving: boolean;
  isRegenerating: boolean;
  isDeleting: boolean;
  isDirty: boolean;
  
  // Stany dialogu
  isDeleteDialogOpen: boolean;
  
  // Błędy
  metadataErrors: MetadataErrors;
  aiResponseErrors: AIResponseErrors;
  apiError: string | null;
}

// Inicjalny stan
const initialState: AnalysisDetailState = {
  analysis: null,
  editedMetadata: { pr_name: '', branch_name: '', ticket_id: '' },
  editedAiResponse: { summary: '', risks: '', tests: '' },
  editedStatusId: 1,
  cardEditModes: { summary: false, risks: false, tests: false },
  isLoading: true,
  isSaving: false,
  isRegenerating: false,
  isDeleting: false,
  isDirty: false,
  isDeleteDialogOpen: false,
  metadataErrors: { pr_name: null, branch_name: null, ticket_id: null },
  aiResponseErrors: { summary: null, risks: null, tests: null },
  apiError: null,
};
```

### 5.3. Typy propsów komponentów

```typescript
interface AnalysisDetailContainerProps {
  analysisId: string;
}

interface AnalysisDetailSkeletonProps {
  // Brak propsów
}

interface MetadataFieldsProps {
  values: MetadataValues;
  errors: MetadataErrors;
  disabled: boolean;
  onChange: (field: keyof MetadataValues, value: string) => void;
}

interface DiffDisplayProps {
  content: string;
  maxHeight?: string;
}

interface QualityRatingProps {
  value: number | null;
  disabled: boolean;
  onChange: (statusId: number) => void;
}

interface ResultsSectionProps {
  aiResponse: AIResponse;
  editModes: CardEditModes;
  errors?: AIResponseErrors;
  onEdit: (field: keyof AIResponse, value: string) => void;
  onToggleMode: (field: keyof AIResponse) => void;
}

interface ResultCardProps {
  title: string;
  content: string;
  isEditMode: boolean;
  error?: string | null;
  onEdit: (value: string) => void;
  onToggleMode: () => void;
}

interface ActionButtonsDetailProps {
  isFormValid: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isRegenerating: boolean;
  isDeleting: boolean;
  hasResults: boolean;
  onSave: () => void;
  onRegenerate: () => void;
  onCopyAll: () => void;
  onDelete: () => void;
}

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  prName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface AiLoaderProps {
  message?: string;
}
```

## 6. Zarządzanie stanem

### 6.1. Custom Hook: `useAnalysisDetail`

Hook zarządzający całym stanem widoku szczegółów analizy. Enkapsuluje logikę pobierania danych, walidacji, komunikacji z API i zarządzania trybami podglądu/edycji kart.

**Lokalizacja:** `src/components/analysis/hooks/useAnalysisDetail.ts`

```typescript
interface UseAnalysisDetailReturn {
  // Stan
  state: AnalysisDetailState;
  
  // Computed values
  isFormValid: boolean;
  hasResults: boolean;
  
  // Akcje metadanych
  updateMetadata: (field: keyof MetadataValues, value: string) => void;
  
  // Akcje AI response
  updateAiResponse: (field: keyof AIResponse, value: string) => void;
  
  // Akcje trybu kart
  toggleCardEditMode: (field: keyof AIResponse) => void;
  
  // Akcje status
  updateStatusId: (statusId: number) => void;
  
  // Akcje główne
  handleSave: () => Promise<void>;
  handleRegenerate: () => Promise<void>;
  handleCopyAll: () => Promise<void>;
  handleDelete: () => Promise<void>;
  
  // Dialog
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
}
```

**Wewnętrzna logika:**
1. `useState` dla `AnalysisDetailState`
2. `useEffect` dla pobrania danych przy montowaniu (fetch GET /api/analysis/:id)
3. `useMemo` dla `isFormValid` (walidacja Zod)
4. `useMemo` dla `hasResults` (sprawdzenie czy ai_response nie jest puste)
5. `useEffect` dla `beforeunload` listener gdy `isDirty === true`
6. `useCallback` dla funkcji API (handleSave, handleRegenerate, handleDelete)
7. Funkcja `toggleCardEditMode` do przełączania trybu podgląd/edycja dla pojedynczej karty

### 6.2. Przepływ stanu

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AnalysisDetailContainer                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    useAnalysisDetail (hook)                            │  │
│  │                                                                        │  │
│  │  state: AnalysisDetailState                                           │  │
│  │    ├── analysis (AnalysisDTO | null)  ─────► źródło prawdy             │  │
│  │    ├── editedMetadata, editedAiResponse ──► kopie do edycji           │  │
│  │    ├── cardEditModes: { summary, risks, tests } ──► tryby kart        │  │
│  │    ├── isLoading, isSaving, isRegenerating, isDeleting                │  │
│  │    ├── isDirty                                                         │  │
│  │    ├── isDeleteDialogOpen                                              │  │
│  │    └── errors (metadata, aiResponse, api)                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│     ┌──────────────────────────────┼─────────────────────────────┐          │
│     ▼                              ▼                             ▼          │
│  MetadataFields              DiffDisplay              QualityRating         │
│  (editedMetadata,            (analysis.diff_content)  (editedStatusId,      │
│   errors, onChange)                                    onChange)             │
│                                                                              │
│     ┌──────────────────────────────┬─────────────────────────────┐          │
│     ▼                              ▼                             ▼          │
│  ResultsSection            ActionButtonsDetail         DeleteConfirmDialog  │
│  (editedAiResponse,        (isDirty, callbacks)        (isOpen, prName,     │
│   cardEditModes,                                        onConfirm, onCancel) │
│   onEdit, onToggleMode)                                                      │
│                                                                              │
│     ┌──────────────────────────────┐                                        │
│     ▼                                                                        │
│  AiLoader                                                                    │
│  (gdy isRegenerating)                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.3. Logika przełączania trybu karty (podgląd/edycja)

```
                    ┌─────────────────────────────────────┐
                    │         ResultCard (np. summary)     │
                    │                                      │
                    │  cardEditModes.summary = false       │
                    │  ┌────────────────────────────────┐  │
                    │  │   Renderowany Markdown         │  │
                    │  │   (tryb podglądu)              │  │
                    │  └────────────────────────────────┘  │
                    │         [Toggle: ikona Edit]         │
                    └──────────────────┬──────────────────┘
                                       │
                              klik toggle button
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │         ResultCard (np. summary)     │
                    │                                      │
                    │  cardEditModes.summary = true        │
                    │  ┌────────────────────────────────┐  │
                    │  │   Textarea (raw markdown)      │  │
                    │  │   (tryb edycji)                │  │
                    │  └────────────────────────────────┘  │
                    │         [Toggle: ikona Eye]          │
                    └─────────────────────────────────────┘
```

Każda karta ma niezależny stan trybu - można mieć np. `summary` w trybie edycji, a `risks` i `tests` w trybie podglądu.

## 7. Integracja API

### 7.1. GET /api/analysis/:id - Pobranie szczegółów analizy

**Wywołanie przy montowaniu:**
```typescript
useEffect(() => {
  const fetchAnalysis = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, apiError: null }));
      
      const response = await fetch(`/api/analysis/${analysisId}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      
      const result: AnalysisResponseDTO = await response.json();
      
      setState(prev => ({
        ...prev,
        analysis: result.data,
        editedMetadata: {
          pr_name: result.data.pr_name,
          branch_name: result.data.branch_name,
          ticket_id: result.data.ticket_id || '',
        },
        editedAiResponse: isEmptyAIResponse(result.data.ai_response)
          ? { summary: '', risks: '', tests: '' }
          : result.data.ai_response as AIResponse,
        editedStatusId: result.data.status.id,
        isLoading: false,
      }));
    } catch (error) {
      // obsługa błędów
    }
  };
  
  fetchAnalysis();
}, [analysisId]);
```

**Odpowiedź sukcesu (200):**
```typescript
{
  data: {
    id: "uuid",
    pr_name: "Feature XYZ",
    branch_name: "feature/xyz",
    diff_content: "diff --git...",
    ai_response: {
      summary: "## Podsumowanie\n\nTen PR wprowadza...",
      risks: "## Ryzyka\n\n- Możliwy wpływ na...",
      tests: "## Plan testów\n\n1. Sprawdzić..."
    },
    status: { id: 2, code: "pending_review" },
    ticket_id: "JIRA-123",
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-01-15T12:00:00Z"
  }
}
```

### 7.2. PUT /api/analysis/:id - Zapis zmian

**Wywołanie:**
```typescript
const handleSave = async () => {
  setState(prev => ({ ...prev, isSaving: true }));
  
  try {
    const response = await fetch(`/api/analysis/${analysisId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        pr_name: editedMetadata.pr_name.trim(),
        branch_name: editedMetadata.branch_name.trim(),
        ai_response: editedAiResponse,
        status_id: editedStatusId,
        ticket_id: editedMetadata.ticket_id?.trim() || undefined,
      } satisfies UpdateAnalysisCommand),
    });
    
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    
    const result: AnalysisResponseDTO = await response.json();
    
    // Aktualizuj źródło prawdy i zresetuj isDirty
    setState(prev => ({
      ...prev,
      analysis: result.data,
      isDirty: false,
      isSaving: false,
    }));
    
    toast.success('Zapisano zmiany');
  } catch (error) {
    // obsługa błędów
  }
};
```

### 7.3. POST /api/analysis/:id/generate - Ponowne generowanie AI

**Wywołanie:**
```typescript
const handleRegenerate = async () => {
  setState(prev => ({ ...prev, isRegenerating: true }));
  
  try {
    const response = await fetch(`/api/analysis/${analysisId}/generate`, {
      method: 'POST',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    
    const result: GenerateAnalysisResponseDTO = await response.json();
    
    // Aktualizuj zarówno analysis jak i edytowane wartości
    setState(prev => ({
      ...prev,
      analysis: prev.analysis ? {
        ...prev.analysis,
        ai_response: result.data,
      } : null,
      editedAiResponse: result.data,
      // Przełącz wszystkie karty na tryb podglądu, aby zobaczyć nowe wyniki
      cardEditModes: { summary: false, risks: false, tests: false },
      isRegenerating: false,
      isDirty: true,  // nowe wyniki wymagają zapisu
    }));
    
    toast.success('Wygenerowano nowy opis');
  } catch (error) {
    // obsługa błędów
  }
};
```

### 7.4. DELETE /api/analysis - Usunięcie analizy

**Wywołanie:**
```typescript
const handleDelete = async () => {
  setState(prev => ({ ...prev, isDeleting: true }));
  
  try {
    const response = await fetch('/api/analysis', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ids: [analysisId],
      } satisfies DeleteAnalysesCommand),
    });
    
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    
    toast.success('Analiza została usunięta');
    
    // Przekierowanie na stronę główną
    window.location.href = '/';
  } catch (error) {
    // obsługa błędów
  }
};
```

## 8. Interakcje użytkownika

### 8.1. Ładowanie widoku

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Wejście na stronę | Page | Skeleton loading → Fetch GET /api/analysis/:id → Wyświetlenie danych |
| Błąd 404 | Page | Toast "Analiza nie znaleziona" → Przekierowanie na `/` |
| Błąd 401 | Page | Toast "Sesja wygasła" → Przekierowanie na `/login` |

### 8.2. Edycja metadanych

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Edycja PR Name | Input | Aktualizacja stanu, walidacja inline, isDirty = true |
| Edycja Branch Name | Input | Aktualizacja stanu, walidacja inline, isDirty = true |
| Edycja Ticket ID | Input | Aktualizacja stanu, isDirty = true |
| Zmiana oceny jakości | Select | Aktualizacja status_id, isDirty = true |

### 8.3. Przełączanie trybu podgląd/edycja dla kart AI

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Kliknięcie toggle (tryb podglądu) | Button (ikona Edit) | Przełączenie karty na tryb edycji (textarea) |
| Kliknięcie toggle (tryb edycji) | Button (ikona Eye) | Przełączenie karty na tryb podglądu (renderowany markdown) |
| Edycja treści w textarea | Textarea | Aktualizacja stanu, isDirty = true |

### 8.4. Akcje główne

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Kliknięcie "Zapisz" | Button | Walidacja → PUT /api/analysis/:id → Toast "Zapisano" → isDirty = false |
| Kliknięcie "Generuj ponownie" | Button | Loader → POST /api/analysis/:id/generate → Aktualizacja wyników → karty w trybie podglądu |
| Kliknięcie "Kopiuj wszystko" | Button | Skopiowanie do schowka → Toast "Skopiowano" |
| Kliknięcie "Usuń" | Button | Otwarcie DeleteConfirmDialog |

### 8.5. Dialog usuwania

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Kliknięcie "Anuluj" w dialogu | Button | Zamknięcie dialogu |
| Kliknięcie "Usuń" w dialogu | Button | DELETE /api/analysis → Toast "Usunięto" → Przekierowanie na `/` |
| Naciśnięcie Escape | Keyboard | Zamknięcie dialogu |

### 8.6. Ochrona przed utratą danych

| Interakcja | Element | Rezultat |
|------------|---------|----------|
| Zamknięcie karty z niezapisanymi zmianami | Browser | Dialog `beforeunload` z natywnym ostrzeżeniem |
| Nawigacja z niezapisanymi zmianami | Link | Ostrzeżenie przed opuszczeniem strony |

## 9. Warunki i walidacja

### 9.1. Walidacja pól metadanych

| Pole | Warunek | Komunikat błędu | Komponent |
|------|---------|-----------------|-----------|
| PR Name | Wymagane | "Nazwa PR jest wymagana" | MetadataFields |
| PR Name | Niepuste po trim | "Nazwa PR nie może być pusta" | MetadataFields |
| Branch Name | Wymagane | "Nazwa brancha jest wymagana" | MetadataFields |
| Branch Name | Niepuste po trim | "Nazwa brancha nie może być pusta" | MetadataFields |
| Branch Name | Max 255 znaków | "Nazwa brancha może mieć max 255 znaków" | MetadataFields |
| Ticket ID | Max 255 znaków | "ID ticketa może mieć max 255 znaków" | MetadataFields |

### 9.2. Walidacja wyników AI (przy zapisie)

| Pole | Warunek | Komunikat błędu | Komponent |
|------|---------|-----------------|-----------|
| Summary | Wymagane | "Podsumowanie jest wymagane" | ResultCard |
| Summary | Niepuste | "Podsumowanie nie może być puste" | ResultCard |
| Risks | Wymagane | "Ryzyka są wymagane" | ResultCard |
| Risks | Niepuste | "Ryzyka nie mogą być puste" | ResultCard |
| Tests | Wymagane | "Plan testów jest wymagany" | ResultCard |
| Tests | Niepuste | "Plan testów nie może być pusty" | ResultCard |

### 9.3. Walidacja status_id

| Pole | Warunek | Komunikat błędu | Komponent |
|------|---------|-----------------|-----------|
| status_id | Dodatnia liczba całkowita | "Nieprawidłowy status" | QualityRating |
| status_id | Jedna z dozwolonych wartości (1, 2, 3) | "Nieznany status" | Backend (422) |

### 9.4. Wpływ walidacji na UI

| Stan walidacji | Wpływ na UI |
|----------------|-------------|
| Błąd w polu metadanych | Czerwona ramka, komunikat pod polem |
| Błąd w polu AI response | Czerwona ramka na karcie (w trybie edycji), komunikat |
| Formularz niepoprawny | Przycisk "Zapisz" disabled |
| Brak zmian (isDirty = false) | Przycisk "Zapisz" disabled |

## 10. Obsługa błędów

### 10.1. Błędy ładowania danych (GET)

```typescript
// 401 - Sesja wygasła
if (response.status === 401) {
  toast.error('Sesja wygasła. Zaloguj się ponownie.');
  window.location.href = '/login';
  return;
}

// 404 - Analiza nie znaleziona
if (response.status === 404) {
  toast.error('Analiza nie została znaleziona.');
  window.location.href = '/';
  return;
}

// 500 - Błąd serwera
if (response.status >= 500) {
  setState(prev => ({
    ...prev,
    isLoading: false,
    apiError: 'Nie udało się pobrać analizy. Spróbuj odświeżyć stronę.',
  }));
}
```

### 10.2. Błędy zapisu (PUT)

```typescript
// 400 - Błąd walidacji
if (response.status === 400) {
  const errorData: ValidationErrorResponse = await response.json();
  
  if (errorData.field_errors) {
    setMetadataErrors({
      pr_name: errorData.field_errors.pr_name?.[0] || null,
      branch_name: null,
      ticket_id: errorData.field_errors.ticket_id?.[0] || null,
    });
    setAiResponseErrors({
      summary: errorData.field_errors['ai_response.summary']?.[0] || null,
      risks: errorData.field_errors['ai_response.risks']?.[0] || null,
      tests: errorData.field_errors['ai_response.tests']?.[0] || null,
    });
  }
  return;
}

// 404 - Analiza nie znaleziona (usunięta w międzyczasie)
if (response.status === 404) {
  toast.error('Analiza nie istnieje. Mogła zostać usunięta.');
  window.location.href = '/';
  return;
}

// 422 - Nieprawidłowy status_id
if (response.status === 422) {
  toast.error('Nieprawidłowy status. Odśwież stronę i spróbuj ponownie.');
  return;
}
```

### 10.3. Błędy generowania AI (POST /generate)

```typescript
const AI_ERROR_MESSAGES: Record<number, string> = {
  429: 'Zbyt wiele żądań. Poczekaj chwilę przed ponowną próbą.',
  502: 'Błąd podczas generowania AI. Spróbuj ponownie.',
  503: 'Serwis AI jest tymczasowo niedostępny.',
  504: 'Przekroczono czas oczekiwania na odpowiedź AI (60s).',
};

if ([429, 502, 503, 504].includes(response.status)) {
  toast.error(AI_ERROR_MESSAGES[response.status], {
    action: {
      label: 'Spróbuj ponownie',
      onClick: () => handleRegenerate(),
    },
  });
  return;
}
```

### 10.4. Błędy usuwania (DELETE)

```typescript
// 400 - Błąd walidacji (nieprawidłowe UUID)
if (response.status === 400) {
  toast.error('Nieprawidłowy identyfikator analizy.');
  closeDeleteDialog();
  return;
}

// 500 - Błąd serwera
if (response.status >= 500) {
  toast.error('Nie udało się usunąć analizy. Spróbuj ponownie.', {
    action: {
      label: 'Ponów',
      onClick: () => handleDelete(),
    },
  });
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
    console.error('Unexpected error:', error);
  }
  
  setState(prev => ({ ...prev, isSaving: false, isRegenerating: false, isDeleting: false }));
}
```

## 11. Kroki implementacji

### Krok 1: Utworzenie strony Astro

1. Utworzyć plik `src/pages/analysis/[id].astro`
2. Pobrać parametr `id` z `Astro.params`
3. Zaimportować `PageLayout` i `AnalysisDetailContainer`
4. Dodać odpowiednie meta tagi (title: "Szczegóły analizy")
5. Ustawić `export const prerender = false;`
6. Przekazać `analysisId` do komponentu React

### Krok 2: Implementacja typów ViewModel

1. Rozszerzyć plik `src/components/analysis/types.ts` o nowe interfejsy:
   - `CardEditModes`
   - `AnalysisDetailState`
   - `AIResponseErrors`
2. Dodać interfejsy propsów dla nowych komponentów:
   - `AnalysisDetailContainerProps`
   - `DiffDisplayProps`
   - `QualityRatingProps`
   - `ActionButtonsDetailProps`
   - `DeleteConfirmDialogProps`
   - `ResultCardProps` (zaktualizowany o `isEditMode` i `onToggleMode`)
   - `MetadataFieldsProps` (wszystkie pola metadanych są edytowalne, w tym `branch_name`)

### Krok 3: Implementacja komponentów pomocniczych

1. **AnalysisDetailSkeleton** - skeleton loading dla całego widoku
2. **DiffDisplay** - wyświetlanie diffu w trybie read-only
3. **QualityRating** - dropdown oceny jakości
4. **DeleteConfirmDialog** - AlertDialog z potwierdzeniem usunięcia
5. **ActionButtonsDetail** - przyciski akcji dla widoku szczegółów

### Krok 4: Implementacja ResultCard z trybem podgląd/edycja

1. Dodać przycisk toggle w nagłówku karty (ikona Eye/Edit)
2. Zaimplementować warunkowe renderowanie:
   - Tryb podglądu: użyć `react-markdown` lub prostego renderowania HTML
   - Tryb edycji: `<Textarea>` z fontem monospace
3. Dodać obsługę przełączania trybu

### Krok 5: Rozszerzenie istniejących komponentów

1. **MetadataFields** - wszystkie pola (pr_name, branch_name, ticket_id) są edytowalne przy aktualizacji analizy
2. **ResultsSection** - dodać przekazywanie `editModes` i `onToggleMode` do kart

### Krok 6: Implementacja custom hooka

1. Utworzyć `src/components/analysis/hooks/useAnalysisDetail.ts`
2. Zaimplementować logikę pobierania danych przy montowaniu
3. Dodać zarządzanie `cardEditModes` z funkcją `toggleCardEditMode`
4. Zaimplementować funkcje walidacji z użyciem schematu Zod
5. Zaimplementować funkcje API: `handleSave`, `handleRegenerate`, `handleDelete`, `handleCopyAll`
6. Dodać efekt `beforeunload` dla ochrony niezapisanych zmian
7. Śledzić `isDirty` przy każdej zmianie w metadanych lub wynikach AI

### Krok 7: Implementacja głównego kontenera

1. Utworzyć `src/components/analysis/AnalysisDetailContainer.tsx`
2. Połączyć hook z komponentami potomnymi
3. Dodać obsługę stanów ładowania (skeleton)
4. Dodać obsługę toast notifications (Sonner)
5. Zaimplementować warunkowe renderowanie komponentów

### Krok 8: Renderowanie Markdown

1. Zainstalować bibliotekę do renderowania markdown (np. `react-markdown`)
2. Skonfigurować dozwolone elementy (nagłówki, listy, bold, italic, code)
3. Dodać podstawowe style dla renderowanego markdown

### Krok 9: Format kopiowania do schowka

1. Zaimplementować funkcję formatującą wyniki do kopiowania:
```typescript
function formatForClipboard(analysis: AnalysisDTO): string {
  const { pr_name, branch_name, ticket_id, ai_response } = analysis;
  
  if (isEmptyAIResponse(ai_response)) {
    return '';
  }
  
  const response = ai_response as AIResponse;
  
  return `## PR: ${pr_name}
**Branch:** ${branch_name}
${ticket_id ? `**Zadanie:** ${ticket_id}\n` : ''}
## Podsumowanie
${response.summary}

## Ryzyka
${response.risks}

## Plan Testu
${response.tests}`;
}
```

### Krok 10: Stylowanie i responsywność

1. Dodać klasy Tailwind dla responsywności
2. Sprawdzić układ na breakpointach: desktop, tablet, mobile
3. Upewnić się, że DiffDisplay ma odpowiednie max-height i scroll
4. Dostosować layout przycisków dla różnych rozmiarów ekranu
5. Stylować toggle button w ResultCard

### Krok 11: Dostępność

1. Dodać etykiety `<Label>` powiązane z polami przez `htmlFor`
2. Dodać `aria-describedby` dla komunikatów błędów
3. Upewnić się, że DeleteConfirmDialog ma poprawny focus trap
4. Dodać `aria-busy` na kontenerze podczas operacji async
5. Dodać `aria-pressed` dla toggle button w ResultCard
6. Przetestować nawigację klawiaturą

### Krok 12: Integracja z nawigacją

1. Upewnić się, że kliknięcie wiersza w `HistoryTable` prowadzi do `/analysis/:id`
2. Dodać link "Powrót do historii" lub breadcrumb

### Krok 13: Testy manualne

1. Przetestować ładowanie analizy i wyświetlanie danych
2. Przetestować przełączanie trybu podgląd/edycja dla każdej karty osobno
3. Przetestować edycję metadanych i wyników AI
4. Przetestować zapis zmian
5. Przetestować ponowne generowanie AI
6. Przetestować kopiowanie do schowka
7. Przetestować usuwanie z potwierdzeniem
8. Przetestować scenariusze błędów (404, timeout, itp.)
9. Przetestować ostrzeżenie `beforeunload` przy niezapisanych zmianach
10. Sprawdzić responsywność na różnych urządzeniach
11. Sprawdzić renderowanie markdown (nagłówki, listy, formatowanie)

### Krok 14: Refaktoryzacja i code review

1. Przejrzeć kod pod kątem best practices React
2. Upewnić się, że wszystkie typy są poprawnie zdefiniowane
3. Sprawdzić obsługę edge cases
4. Zoptymalizować re-rendery (`useMemo`, `useCallback` gdzie potrzebne)
5. Upewnić się o spójności z widokiem "Nowa analiza"

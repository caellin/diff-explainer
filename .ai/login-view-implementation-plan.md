# Plan implementacji widoku Logowanie

## 1. Przegląd

Widok logowania umożliwia użytkownikom bezpieczne uwierzytelnienie w aplikacji Diff Explainer za pomocą adresu email i hasła. Jest to punkt wejścia do aplikacji dla nieuwierzytelnionych użytkowników, zapewniający dostęp do funkcji generowania opisów PR i historii analiz. Widok wykorzystuje Supabase Auth SDK do zarządzania procesem logowania, sesjami i tokenami.

Główne cele widoku:
- Umożliwienie bezpiecznego logowania przez email i hasło
- Natychmiastowa informacja zwrotna przy błędach walidacji i logowania
- Automatyczne przekierowanie zalogowanych użytkowników na stronę główną
- Zapewnienie dostępności i wsparcia dla nawigacji klawiaturowej

## 2. Routing widoku

| Właściwość | Wartość |
|------------|---------|
| Ścieżka | `/login` |
| Plik strony | `src/pages/login.astro` |
| Wymagane logowanie | Nie |
| Zachowanie dla zalogowanych | Przekierowanie na `/` |

### Logika middleware

Middleware Astro (`src/middleware/index.ts`) musi zostać rozszerzony o:
1. Sprawdzenie sesji Supabase dla żądań do `/login`
2. Przekierowanie zalogowanych użytkowników na `/` jeśli próbują uzyskać dostęp do `/login`
3. Przekierowanie niezalogowanych użytkowników na `/login` dla chronionych tras (`/`, `/analysis/*`)

## 3. Struktura komponentów

```
/login (login.astro)
└── Layout.astro
    └── main.login-container
        └── AuthForm (React, client:load)
            ├── Card (shadcn/ui)
            │   ├── CardHeader
            │   │   ├── CardTitle ("Logowanie")
            │   │   └── CardDescription (opcjonalnie)
            │   └── CardContent
            │       └── form
            │           ├── FormField (email)
            │           │   ├── Label
            │           │   ├── Input (type="email")
            │           │   └── FormMessage (błąd walidacji)
            │           ├── FormField (password)
            │           │   ├── Label
            │           │   ├── Input (type="password")
            │           │   └── FormMessage (błąd walidacji)
            │           ├── Alert (błąd ogólny - widoczny warunkowo)
            │           │   ├── AlertCircle (ikona)
            │           │   └── AlertDescription
            │           └── Button (submit)
            │               └── Loader2 (ikona - widoczna podczas ładowania)
            └── Toaster (shadcn/ui Sonner)
```

## 4. Szczegóły komponentów

### 4.1. LoginPage (login.astro)

- **Opis**: Strona Astro stanowiąca kontener dla widoku logowania. Odpowiada za strukturę HTML, meta tagi i osadzenie interaktywnego komponentu React.
- **Główne elementy**:
  - `Layout` - wspólny layout aplikacji z tytułem "Logowanie - Diff Explainer"
  - `main` - kontener główny z klasami centrującymi formularz
  - `AuthForm` - komponent React z dyrektywą `client:load`
- **Obsługiwane interakcje**: Brak (statyczny kontener)
- **Obsługiwana walidacja**: Brak
- **Typy**: Brak
- **Propsy**: Brak

### 4.2. AuthForm

- **Opis**: Główny komponent React obsługujący formularz logowania. Zarządza stanem formularza, walidacją client-side oraz komunikacją z Supabase Auth.
- **Lokalizacja**: `src/components/auth/AuthForm.tsx`
- **Główne elementy**:
  - `Card` - kontener wizualny formularza (shadcn/ui)
  - `form` - element formularza z atrybutem `noValidate`
  - Pola `email` i `password` z odpowiednimi etykietami
  - `Alert` - komponent do wyświetlania błędów ogólnych
  - `Button` - przycisk submit z obsługą stanu ładowania
- **Obsługiwane interakcje**:
  - `onChange` na polach formularza - aktualizacja stanu i czyszczenie błędów pola
  - `onSubmit` na formularzu - walidacja i wywołanie API
  - `onBlur` na polach - opcjonalna walidacja przy utracie fokusa
- **Obsługiwana walidacja**:
  - Email: wymagany, poprawny format email
  - Hasło: wymagane, minimum 1 znak
  - Błędy API: nieprawidłowe dane logowania, rate limiting
- **Typy**:
  - `LoginFormData` - dane formularza
  - `LoginFormState` - stan formularza (loading, errors)
  - `LoginFormSchema` - schemat walidacji Zod
- **Propsy**: Brak (komponent samodzielny)

### 4.3. Komponenty shadcn/ui do użycia

| Komponent | Źródło | Użycie |
|-----------|--------|--------|
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `@/components/ui/card` | Kontener formularza |
| `Input` | `@/components/ui/input` | Pola email i hasło |
| `Label` | `@/components/ui/label` | Etykiety pól formularza |
| `Button` | `@/components/ui/button` | Przycisk submit |
| `Alert`, `AlertDescription` | `@/components/ui/alert` | Komunikat błędu ogólnego |
| `Sonner/Toaster` | `@/components/ui/sonner` | Powiadomienia toast |

## 5. Typy

### 5.1. LoginFormData

Typ reprezentujący dane wprowadzone przez użytkownika w formularzu.

```typescript
interface LoginFormData {
  /** Adres email użytkownika */
  email: string;
  /** Hasło użytkownika */
  password: string;
}
```

### 5.2. LoginFormState

Typ reprezentujący stan formularza logowania.

```typescript
interface LoginFormState {
  /** Czy trwa operacja logowania */
  isLoading: boolean;
  /** Ogólny błąd (np. z API Supabase) */
  error: string | null;
  /** Błędy walidacji per pole */
  fieldErrors: {
    email?: string;
    password?: string;
  };
}
```

### 5.3. LoginValidationSchema (Zod)

Schemat walidacji Zod dla formularza logowania.

```typescript
// src/lib/schemas/auth.schema.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email jest wymagany" })
    .min(1, "Email jest wymagany")
    .email("Nieprawidłowy format adresu email"),
  password: z
    .string({ required_error: "Hasło jest wymagane" })
    .min(1, "Hasło jest wymagane"),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

### 5.4. SupabaseAuthError (mapowanie błędów)

Mapowanie kodów błędów Supabase na komunikaty dla użytkownika.

```typescript
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "invalid_credentials": "Nieprawidłowy email lub hasło",
  "email_not_confirmed": "Adres email nie został potwierdzony",
  "user_not_found": "Nie znaleziono użytkownika",
  "too_many_requests": "Zbyt wiele prób logowania. Spróbuj ponownie później",
  "default": "Wystąpił błąd podczas logowania. Spróbuj ponownie",
};
```

## 6. Zarządzanie stanem

### 6.1. Stan lokalny komponentu AuthForm

Zarządzanie stanem odbywa się za pomocą hooków React `useState`:

```typescript
// Dane formularza
const [formData, setFormData] = useState<LoginFormData>({
  email: "",
  password: "",
});

// Stan formularza (loading, errors)
const [formState, setFormState] = useState<LoginFormState>({
  isLoading: false,
  error: null,
  fieldErrors: {},
});
```

### 6.2. Custom Hook: useLogin (opcjonalnie)

Dla lepszej separacji logiki można wyodrębnić hook `useLogin`:

```typescript
// src/components/hooks/useLogin.ts
interface UseLoginReturn {
  login: (data: LoginFormData) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useLogin(): UseLoginReturn {
  // Logika logowania z Supabase
}
```

### 6.3. Brak stanu globalnego

Widok logowania nie wymaga stanu globalnego. Sesja użytkownika jest zarządzana przez Supabase SDK, który przechowuje tokeny w localStorage/cookies.

## 7. Integracja API

### 7.1. Supabase Auth SDK

Widok wykorzystuje bezpośrednio Supabase Auth SDK bez pośrednictwa własnego API.

#### Metoda logowania

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function handleLogin(data: LoginFormData): Promise<void> {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    throw error;
  }

  // Sukces - przekierowanie
  window.location.href = "/";
}
```

#### Typy żądania i odpowiedzi

**Żądanie (signInWithPassword)**:
```typescript
{
  email: string;
  password: string;
}
```

**Odpowiedź sukcesu (AuthResponse)**:
```typescript
{
  data: {
    user: User | null;
    session: Session | null;
  };
  error: null;
}
```

**Odpowiedź błędu (AuthError)**:
```typescript
{
  data: { user: null; session: null };
  error: {
    message: string;
    status: number;
    code?: string;
  };
}
```

### 7.2. Sprawdzenie sesji

Przed wyświetleniem formularza należy sprawdzić, czy użytkownik jest już zalogowany:

```typescript
// W middleware lub na poziomie strony
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  // Przekieruj na /
}
```

## 8. Interakcje użytkownika

| Interakcja | Element | Oczekiwany wynik |
|------------|---------|------------------|
| Wprowadzenie tekstu w pole email | `Input[type="email"]` | Aktualizacja `formData.email`, wyczyszczenie `fieldErrors.email` |
| Wprowadzenie tekstu w pole hasło | `Input[type="password"]` | Aktualizacja `formData.password`, wyczyszczenie `fieldErrors.password` |
| Naciśnięcie Tab | Dowolne pole | Przejście fokusa do następnego elementu |
| Naciśnięcie Enter | Dowolne pole formularza | Wywołanie submit formularza |
| Kliknięcie "Zaloguj się" | `Button[type="submit"]` | Walidacja → API call → przekierowanie lub błąd |
| Submit z pustym email | Formularz | Wyświetlenie błędu "Email jest wymagany" |
| Submit z nieprawidłowym email | Formularz | Wyświetlenie błędu "Nieprawidłowy format adresu email" |
| Submit z pustym hasłem | Formularz | Wyświetlenie błędu "Hasło jest wymagane" |
| Submit z błędnymi danymi | Formularz | Wyświetlenie Alert z "Nieprawidłowy email lub hasło" |
| Pomyślne logowanie | Formularz | Przekierowanie na `/` |

### Sekwencja submit formularza

```
1. Użytkownik klika "Zaloguj się"
2. preventDefault()
3. Ustawienie isLoading = true, wyczyszczenie errors
4. Walidacja Zod (client-side)
   ├── Błąd → Ustawienie fieldErrors, isLoading = false
   └── Sukces → Kontynuuj
5. Wywołanie supabase.auth.signInWithPassword()
   ├── Błąd → Mapowanie błędu, ustawienie error, isLoading = false
   └── Sukces → window.location.href = "/"
```

## 9. Warunki i walidacja

### 9.1. Walidacja client-side (Zod)

| Pole | Warunek | Komunikat błędu | Wpływ na UI |
|------|---------|-----------------|-------------|
| email | Niepuste | "Email jest wymagany" | FormMessage pod polem, czerwona ramka |
| email | Format email | "Nieprawidłowy format adresu email" | FormMessage pod polem, czerwona ramka |
| password | Niepuste | "Hasło jest wymagane" | FormMessage pod polem, czerwona ramka |

### 9.2. Walidacja server-side (Supabase)

| Scenariusz | Kod błędu | Komunikat dla użytkownika |
|------------|-----------|---------------------------|
| Złe hasło lub email | `invalid_credentials` | "Nieprawidłowy email lub hasło" |
| Email niepotwierdzony | `email_not_confirmed` | "Adres email nie został potwierdzony" |
| Zbyt wiele prób | `too_many_requests` | "Zbyt wiele prób logowania. Spróbuj ponownie później" |
| Inny błąd | - | "Wystąpił błąd podczas logowania. Spróbuj ponownie" |

### 9.3. Stan przycisku submit

| Warunek | Stan przycisku |
|---------|----------------|
| `isLoading === true` | `disabled`, wyświetla Loader2 + "Logowanie..." |
| `isLoading === false` | `enabled`, wyświetla "Zaloguj się" |

## 10. Obsługa błędów

### 10.1. Typy błędów i ich obsługa

| Typ błędu | Źródło | Komponent UI | Zachowanie |
|-----------|--------|--------------|------------|
| Błąd walidacji pola | Zod | `FormMessage` pod polem | Inline pod konkretnym polem, czerwona ramka |
| Błąd uwierzytelnienia | Supabase Auth | `Alert` w formularzu | Widoczny nad przyciskiem submit |
| Błąd sieci | fetch/network | `Alert` w formularzu | "Błąd połączenia. Sprawdź połączenie z internetem" |
| Rate limiting | Supabase | `Alert` w formularzu | "Zbyt wiele prób logowania. Spróbuj ponownie później" |
| Nieoczekiwany błąd | catch-all | `Alert` w formularzu | "Wystąpił nieoczekiwany błąd. Spróbuj ponownie" |

### 10.2. Funkcja mapowania błędów

```typescript
function mapAuthError(error: AuthError): string {
  const code = error.code || error.message;
  
  if (code.includes("invalid") || code.includes("credentials")) {
    return "Nieprawidłowy email lub hasło";
  }
  if (code.includes("too_many") || code.includes("rate")) {
    return "Zbyt wiele prób logowania. Spróbuj ponownie później";
  }
  if (code.includes("not_confirmed")) {
    return "Adres email nie został potwierdzony";
  }
  
  return "Wystąpił błąd podczas logowania. Spróbuj ponownie";
}
```

### 10.3. Obsługa błędów sieciowych

```typescript
try {
  await supabase.auth.signInWithPassword(credentials);
} catch (error) {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    setFormState(prev => ({
      ...prev,
      error: "Błąd połączenia. Sprawdź połączenie z internetem",
      isLoading: false,
    }));
    return;
  }
  // Inne błędy...
}
```

## 11. Kroki implementacji

### Krok 1: Instalacja wymaganych komponentów shadcn/ui

```bash
npx shadcn@latest add card input label alert
```

### Krok 2: Utworzenie schematu walidacji

Utworzenie pliku `src/lib/schemas/auth.schema.ts`:
- Definicja `loginSchema` z walidacją Zod
- Eksport typu `LoginInput`
- Definicja mapowania błędów `AUTH_ERROR_MESSAGES`

### Krok 3: Utworzenie typów dla formularza

Dodanie do pliku `src/types.ts` lub utworzenie `src/components/auth/types.ts`:
- Interfejs `LoginFormData`
- Interfejs `LoginFormState`

### Krok 4: Utworzenie komponentu AuthForm

Utworzenie pliku `src/components/auth/AuthForm.tsx`:
1. Importy komponentów shadcn/ui i hooków React
2. Stan formularza (`useState` dla `formData` i `formState`)
3. Funkcja `handleInputChange` - aktualizacja pola i czyszczenie błędów
4. Funkcja `handleSubmit`:
   - Walidacja Zod
   - Wywołanie Supabase `signInWithPassword`
   - Obsługa błędów i przekierowanie
5. Renderowanie formularza z Card, polami Input i Button
6. Warunkowe renderowanie Alert dla błędów ogólnych
7. Warunkowe renderowanie FormMessage dla błędów pól

### Krok 5: Utworzenie strony login.astro

Utworzenie pliku `src/pages/login.astro`:
1. Import Layout i AuthForm
2. Sprawdzenie sesji w frontmatter (opcjonalne)
3. Struktura HTML z centrowanym kontenerem
4. Osadzenie `<AuthForm client:load />`
5. Dodanie `<Toaster />` dla powiadomień

### Krok 6: Aktualizacja middleware

Rozszerzenie `src/middleware/index.ts`:
1. Dodanie obsługi sesji Supabase z cookies
2. Logika przekierowania dla `/login` (zalogowani → `/`)
3. Logika przekierowania dla chronionych tras (niezalogowani → `/login`)
4. Lista chronionych tras: `/`, `/analysis/*`

### Krok 7: Konfiguracja klienta Supabase dla auth

Utworzenie lub aktualizacja klienta Supabase w `src/db/supabase.client.ts`:
- Konfiguracja dla SSR z obsługą cookies
- Metody pomocnicze dla auth (opcjonalnie)

### Krok 8: Stylowanie i responsywność

1. Klasy Tailwind dla centrowania formularza
2. Responsywna szerokość Card (mobile: pełna, desktop: max-w-md)
3. Odpowiednie odstępy i padding
4. Dark mode wsparcie (jeśli wymagane)

### Krok 9: Dostępność

1. Dodanie `aria-describedby` do pól z błędami
2. Dodanie `aria-invalid` do pól z błędami
3. Dodanie `aria-busy` do formularza podczas ładowania
4. Upewnienie się, że fokus jest widoczny (focus-visible)
5. Testowanie nawigacji klawiaturowej (Tab, Enter)

### Krok 10: Testowanie

1. Test pomyślnego logowania → przekierowanie
2. Test błędnych danych → wyświetlenie błędu
3. Test walidacji client-side → błędy inline
4. Test stanu ładowania → disabled button, loader
5. Test dostępności → screen reader, keyboard
6. Test responsywności → mobile, tablet, desktop
7. Test przekierowania zalogowanych z `/login` → `/`

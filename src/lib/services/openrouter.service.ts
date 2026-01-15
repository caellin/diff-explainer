import type { AIResponse } from "../../types";

/**
 * Wynik generowania analizy przez AI.
 */
export interface AIGenerationResult {
  /** Wygenerowana odpowiedź AI */
  response: AIResponse;
  /** Liczba zużytych tokenów */
  tokenUsage: number;
  /** Model użyty do generowania */
  model: string;
  /** Kod statusu HTTP */
  statusCode: number;
}

/**
 * Błąd generowania AI.
 */
export interface AIGenerationError {
  /** Komunikat błędu */
  message: string;
  /** Kod statusu HTTP */
  statusCode: number;
  /** Liczba zużytych tokenów (może być 0 przy błędzie) */
  tokenUsage: number;
  /** Model użyty do generowania */
  model: string;
}

/**
 * Domyślny model używany w mock serwisie.
 */
const MOCK_MODEL = "mock/gpt-4o-mini";

/**
 * Symulowane opóźnienie odpowiedzi AI (w ms).
 */
const MOCK_DELAY_MS = 500;

/**
 * Słowa kluczowe do symulacji błędów w mock serwisie.
 * Użycie ich w nazwie PR lub diff content spowoduje wygenerowanie błędu.
 */
const ERROR_SIMULATION_KEYWORDS = {
  /** Symuluje błąd 500 - wewnętrzny błąd serwera */
  INTERNAL_ERROR: "MOCK_ERROR_500",
  /** Symuluje błąd 503 - serwis niedostępny */
  SERVICE_UNAVAILABLE: "MOCK_ERROR_503",
  /** Symuluje błąd 504 - timeout */
  TIMEOUT: "MOCK_ERROR_TIMEOUT",
  /** Symuluje błąd 429 - rate limit */
  RATE_LIMIT: "MOCK_ERROR_429",
} as const;

/**
 * Sprawdza czy tekst zawiera słowo kluczowe symulujące błąd.
 * @returns Obiekt błędu do rzucenia lub null jeśli brak symulacji
 */
function checkForErrorSimulation(text: string, model: string): AIGenerationError | null {
  if (text.includes(ERROR_SIMULATION_KEYWORDS.INTERNAL_ERROR)) {
    return {
      message: "Internal server error from AI provider",
      statusCode: 500,
      tokenUsage: 0,
      model,
    };
  }

  if (text.includes(ERROR_SIMULATION_KEYWORDS.SERVICE_UNAVAILABLE)) {
    return {
      message: "AI service is temporarily unavailable",
      statusCode: 503,
      tokenUsage: 0,
      model,
    };
  }

  if (text.includes(ERROR_SIMULATION_KEYWORDS.TIMEOUT)) {
    return {
      message: "AI request timeout - service did not respond in time",
      statusCode: 504,
      tokenUsage: 0,
      model,
    };
  }

  if (text.includes(ERROR_SIMULATION_KEYWORDS.RATE_LIMIT)) {
    return {
      message: "Rate limit exceeded - too many requests",
      statusCode: 429,
      tokenUsage: 0,
      model,
    };
  }

  return null;
}

/**
 * Generuje mockową odpowiedź AI na podstawie diffa.
 * Używane podczas lokalnego developmentu i testów.
 */
function generateMockResponse(diffContent: string, prName: string, branchName: string, ticketId?: string): AIResponse {
  // Analizuj diff aby wygenerować sensowną odpowiedź
  const lines = diffContent.split("\n");
  const addedLines = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
  const removedLines = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
  const fileChanges = lines.filter((line) => line.startsWith("diff --git")).length;

  const ticketInfo = ticketId ? `\n- Powiązany ticket: ${ticketId}` : "";

  return {
    summary: `## Podsumowanie

Ten PR "${prName}" z brancha \`${branchName}\` wprowadza następujące zmiany:

- **Dodanych linii:** ${addedLines}
- **Usuniętych linii:** ${removedLines}
- **Zmienionych plików:** ${fileChanges}${ticketInfo}

### Opis zmian

[Mock AI] Analiza wygenerowana przez mock serwis AI. W środowisku produkcyjnym tutaj pojawi się szczegółowa analiza zmian w kodzie.`,

    risks: `## Potencjalne ryzyka

[Mock AI] Poniższe ryzyka zostały automatycznie zidentyfikowane:

1. **Brak testów jednostkowych** - Należy upewnić się, że zmiany są pokryte testami
2. **Potencjalne breaking changes** - Przy ${removedLines} usuniętych liniach, sprawdź kompatybilność wsteczną
3. **Review bezpieczeństwa** - Zalecana ręczna weryfikacja zmian pod kątem bezpieczeństwa

> ⚠️ To jest mock odpowiedzi. W produkcji AI dokładnie przeanalizuje rzeczywiste ryzyka.`,

    tests: `## Sugerowane testy

[Mock AI] Zalecane testy dla tego PR:

### Testy jednostkowe
1. Test podstawowej funkcjonalności nowych zmian
2. Testy regresji dla zmodyfikowanych komponentów
3. Testy edge cases

### Testy integracyjne
1. Weryfikacja integracji z istniejącymi modułami
2. Test end-to-end przepływu użytkownika

### Testy manualne
1. Sprawdzenie UI/UX na różnych rozdzielczościach
2. Weryfikacja dostępności (a11y)

> ℹ️ To jest mock odpowiedzi. W produkcji AI zasugeruje konkretne testy.`,
  };
}

/**
 * Mock serwisu OpenRouter do lokalnego developmentu i testów.
 *
 * Ta klasa symuluje zachowanie prawdziwego serwisu OpenRouter,
 * ale zwraca mockowe odpowiedzi bez wykonywania żądań HTTP.
 *
 * @example
 * ```typescript
 * const service = new OpenRouterService("mock-api-key");
 * const result = await service.generateAnalysis(diff, prName, branch);
 * ```
 */
export class OpenRouterService {
  private readonly model: string;

  /**
   * Tworzy nową instancję mock serwisu OpenRouter.
   *
   * @param _apiKey - Klucz API (ignorowany w mock implementacji)
   * @param model - Model do użycia (domyślnie mock/gpt-4o-mini)
   */
  constructor(_apiKey: string, model: string = MOCK_MODEL) {
    // API key jest ignorowany w mock implementacji
    this.model = model;
  }

  /**
   * Generuje mockową analizę diffa.
   *
   * Symuluje opóźnienie sieci i zwraca przygotowaną odpowiedź
   * na podstawie metadanych diffa.
   *
   * **Symulacja błędów:**
   * Aby zasymulować błędy zewnętrznego API, umieść jedno z poniższych
   * słów kluczowych w nazwie PR lub diff content:
   * - `MOCK_ERROR_500` - błąd 500 (internal server error)
   * - `MOCK_ERROR_503` - błąd 503 (service unavailable)
   * - `MOCK_ERROR_TIMEOUT` - błąd 504 (timeout)
   * - `MOCK_ERROR_429` - błąd 429 (rate limit)
   *
   * @param diffContent - Zawartość diffa git
   * @param prName - Nazwa Pull Requesta
   * @param branchName - Nazwa brancha
   * @param ticketId - Opcjonalny identyfikator ticketa
   * @returns Wynik generowania z mockową odpowiedzią AI
   * @throws AIGenerationError gdy wykryto słowo kluczowe symulacji błędu
   */
  async generateAnalysis(
    diffContent: string,
    prName: string,
    branchName: string,
    ticketId?: string
  ): Promise<AIGenerationResult> {
    // Symuluj opóźnienie sieci
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

    // Sprawdź czy należy zasymulować błąd
    const combinedText = `${prName} ${branchName} ${diffContent}`;
    const simulatedError = checkForErrorSimulation(combinedText, this.model);
    if (simulatedError) {
      throw simulatedError;
    }

    // Wygeneruj mockową odpowiedź
    const response = generateMockResponse(diffContent, prName, branchName, ticketId);

    // Symuluj zużycie tokenów (przybliżone na podstawie długości)
    const inputTokens = Math.ceil((diffContent.length + prName.length + branchName.length) / 4);
    const outputTokens = Math.ceil((response.summary.length + response.risks.length + response.tests.length) / 4);

    return {
      response,
      tokenUsage: inputTokens + outputTokens,
      model: this.model,
      statusCode: 200,
    };
  }
}

/**
 * Eksportowane słowa kluczowe do symulacji błędów.
 * Można ich użyć w testach do wymuszenia określonych scenariuszy błędów.
 */
export { ERROR_SIMULATION_KEYWORDS };

/**
 * Supabase mock factory for unit tests.
 *
 * Usage:
 *   const { mockService, mockClient } = createSupabaseMock({
 *     usuarios: [{ data: fixtures.usuario_socio, error: null }],
 *     socios:   [{ data: fixtures.socio_con_abono, error: null }],
 *   });
 *
 * Responses are consumed in order of terminal calls (.single(), .maybeSingle(), or
 * awaiting the builder directly via then()). Provide one entry per expected call.
 */

export interface MockResponse {
  data?: any;
  error?: any;
  count?: number;
}

/**
 * Creates a chainable query builder mock for a single table.
 * All chain methods return `this`. Terminal methods (.single, .maybeSingle, then)
 * consume responses from the queue in call order.
 */
function createQueryBuilder(responses: MockResponse[] = []) {
  let callCount = 0;

  const getNext = (): MockResponse => {
    const r = responses[callCount] ?? { data: null, error: null };
    callCount++;
    return r;
  };

  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    returns: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => Promise.resolve(getNext())),
    maybeSingle: jest.fn().mockImplementation(() => Promise.resolve(getNext())),
    // Makes `await builder` work — called by Promise.resolve/all internals
    then: jest.fn().mockImplementation((resolve: any, reject?: any) =>
      Promise.resolve(getNext()).then(resolve, reject),
    ),
  };

  return builder;
}

/**
 * Creates a mock SupabaseService. Pass a map of table → response queue.
 * All three client getters return the same mock client.
 */
export function createSupabaseMock(
  tableMap: Record<string, MockResponse[]> = {},
  rpcResponses: MockResponse[] = [],
) {
  const builders: Record<string, ReturnType<typeof createQueryBuilder>> = {};

  // Pre-build a builder per table from the provided response map
  for (const [table, responses] of Object.entries(tableMap)) {
    builders[table] = createQueryBuilder(responses);
  }

  let rpcCallCount = 0;
  const getRpcNext = (): MockResponse => {
    const r = rpcResponses[rpcCallCount] ?? { data: true, error: null };
    rpcCallCount++;
    return r;
  };

  const mockClient = {
    from: jest.fn().mockImplementation((table: string) => {
      if (!builders[table]) {
        builders[table] = createQueryBuilder();
      }
      return builders[table];
    }),
    rpc: jest.fn().mockImplementation(() => Promise.resolve(getRpcNext())),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'new-uuid-001' } },
          error: null,
        }),
        updateUserById: jest.fn().mockResolvedValue({ data: {}, error: null }),
        getUserById: jest.fn().mockResolvedValue({
          data: { user: { id: 'uuid-001' } },
          error: null,
        }),
      },
    },
  };

  const mockService = {
    getClient: jest.fn().mockReturnValue(mockClient),
    getAuthenticatedClient: jest.fn().mockReturnValue(mockClient),
    getOptionalClient: jest.fn().mockReturnValue(mockClient),
  };

  return { mockService, mockClient, builders };
}

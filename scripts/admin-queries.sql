-- =============================================================================
-- SELECTs que o admin usa (rode no SQL Editor do Supabase para ver as respostas)
-- =============================================================================

-- 1) Perfis (mesmo que GET /api/admin/users usa para listar usuários)
SELECT id, email, full_name
FROM public.profiles
ORDER BY full_name ASC
LIMIT 20;

-- 2) View de receitas/despesas por usuário (equivalente ao que a API lê)
SELECT user_id, receitas, despesas
FROM public.user_financial_stats
ORDER BY user_id
LIMIT 20;

-- 3) Se a view não existir ou quiser conferir os números, use este SELECT
--    (equivalente ao que a view faz: crédito = receitas, débito = despesas em valor positivo)
SELECT
  bc.user_id,
  COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0)::numeric(14,2) AS receitas,
  ABS(COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0))::numeric(14,2) AS despesas
FROM public.bank_connections bc
JOIN public.accounts a ON a.connection_id = bc.id
JOIN public.transactions t ON t.account_id = a.id
GROUP BY bc.user_id
ORDER BY bc.user_id
LIMIT 20;

-- 4) Amostra de transações (para ver sinal: credit = positivo, debit = negativo?)
SELECT id, account_id, date, description, amount, type
FROM public.transactions
ORDER BY date DESC
LIMIT 15;

export function getBasePath() {
  const value = process.env.MATHMAGICIAN_BASE_PATH || '';
  if (!['', '/mathmagician'].includes(value)) {
    throw new Error('MATHMAGICIAN_BASE_PATH must be empty or /mathmagician');
  }
  return value;
}

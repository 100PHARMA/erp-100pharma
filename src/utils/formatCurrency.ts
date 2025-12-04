/**
 * Formata valores numéricos para o padrão de moeda Euro (EUR) - Portugal
 * 
 * @param value - Valor numérico a ser formatado
 * @returns String formatada no padrão pt-PT (ex: "479,33 €")
 * 
 * @example
 * formatCurrency(1234.56) // "1 234,56 €"
 * formatCurrency(null) // "€ 0,00"
 * formatCurrency(undefined) // "€ 0,00"
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '0,00 €';
  
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

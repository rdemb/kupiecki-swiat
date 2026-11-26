const plural = new Intl.PluralRules('pl');
export function sacks(n: number) {
  const form = plural.select(n);
  return (
    n + ' ' + (form === 'one' ? 'worek' : form === 'few' ? 'worki' : 'worków')
  );
}

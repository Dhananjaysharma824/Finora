import { useCallback } from 'react';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { formatMoney } from '@/utils/money';

export function useMoneyFormatter() {
  const preferences = useFinoraStore((s) => s.preferences);

  const fmt = useCallback(
    (paise: number, showSign = false) =>
      formatMoney(paise, {
        currency: preferences.currency,
        numberFormat: preferences.numberFormat,
        showSign,
      }),
    [preferences.currency, preferences.numberFormat],
  );

  return {
    fmt,
    currency: preferences.currency,
    numberFormat: preferences.numberFormat,
    dateFormat: preferences.dateFormat,
  };
}

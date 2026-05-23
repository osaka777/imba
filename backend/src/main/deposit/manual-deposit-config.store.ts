import { ManualDepositCurrency, ManualDepositConfigItem } from './manual-deposit.types';
import { getManualDepositFromSettings } from '../payment-settings/payment-settings.store';

export type { ManualDepositCurrency, ManualDepositConfigItem };

export function getManualDepositConfig(
  currency: ManualDepositCurrency,
): ManualDepositConfigItem {
  return getManualDepositFromSettings(currency);
}

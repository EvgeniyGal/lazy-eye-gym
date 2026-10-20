import {
  ErrorCode,
  getUserFriendlyErrorMessage,
  isUserCancelledError,
  useIAP,
  type Product,
} from 'expo-iap';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useT } from '@/src/i18n/I18nProvider';

import { TIP_PRODUCT_IDS, type TipProductId } from './tipJar';

export type TipJarState = {
  connected: boolean;
  productsById: Map<string, Product>;
  purchasingSku: string | null;
  thanked: boolean;
  purchase: (sku: TipProductId) => Promise<void>;
};

/**
 * Tip jar via Google Play / App Store consumables.
 * Mount only when `isTipJarAvailable()` is true (native build).
 */
export function useTipJar(): TipJarState {
  const { t } = useT();
  const [purchasingSku, setPurchasingSku] = useState<string | null>(null);
  const [thanked, setThanked] = useState(false);

  const { connected, products, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void (async () => {
        try {
          await finishTransaction({ purchase, isConsumable: true });
          setThanked(true);
        } catch (error) {
          console.warn('Tip jar finishTransaction failed', error);
          Alert.alert(t('support.errorTitle'), t('support.errorBody'));
        } finally {
          setPurchasingSku(null);
        }
      })();
    },
    onPurchaseError: (error) => {
      setPurchasingSku(null);
      if (isUserCancelledError(error) || error.code === ErrorCode.UserCancelled) {
        return;
      }
      Alert.alert(
        t('support.errorTitle'),
        getUserFriendlyErrorMessage(error) || t('support.errorBody'),
      );
    },
  });

  useEffect(() => {
    if (!connected) return;
    void fetchProducts({ skus: [...TIP_PRODUCT_IDS], type: 'in-app' }).catch((error) => {
      console.warn('Tip jar product fetch failed', error);
    });
  }, [connected, fetchProducts]);

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const purchase = useCallback(
    async (sku: TipProductId) => {
      setPurchasingSku(sku);
      setThanked(false);
      try {
        await requestPurchase({
          request: {
            apple: { sku },
            google: { skus: [sku] },
          },
          type: 'in-app',
        });
      } catch (error) {
        setPurchasingSku(null);
        console.warn('Tip jar purchase request failed', error);
        Alert.alert(t('support.errorTitle'), t('support.errorBody'));
      }
    },
    [requestPurchase, t],
  );

  return {
    connected,
    productsById,
    purchasingSku,
    thanked,
    purchase,
  };
}

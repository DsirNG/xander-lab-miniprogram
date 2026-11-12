import { Text, View } from '@tarojs/components'
import type { VirtualPayProduct } from '@/api/virtualPay'
import { Button } from '@/components/ui/Button'
import { t } from '@/i18n'

export function PointsCards({
  products,
  selectedId,
  onSelect,
  onBuy,
  enabled,
  subscriber,
  buying,
}: {
  products: VirtualPayProduct[]
  selectedId: string
  onSelect: (id: string) => void
  onBuy: (product: VirtualPayProduct) => void
  enabled: boolean
  subscriber: boolean
  buying: string
}) {
  const selected = products.find(product => product.productId === selectedId) ?? products[0]
  return (
    <View className="points-purchase-card">
      <Text className="subscription-section-title">{t('subscription.pointsCards')}</Text>
      <Text className="subscription-product-meta">{t('subscription.pointsCardRule')}</Text>
      <View className="points-card-options">
        {products.map(product => (
          <Button
            key={product.productId}
            variant="secondary"
            className={`points-card-option${selected?.productId === product.productId ? ' is-selected' : ''}`}
            disabled={Boolean(buying) || !enabled}
            aria-pressed={selected?.productId === product.productId}
            onClick={() => onSelect(product.productId)}
          >
            <Text className="points-card-amount">
              {t('wallet.quantity', { points: product.points ?? 0 })}
            </Text>
            <Text className="points-card-price">¥{(product.goodsPrice / 100).toFixed(2)}</Text>
          </Button>
        ))}
      </View>
      {!products.length ? (
        <Text className="subscription-state">{t('subscription.noPointsCards')}</Text>
      ) : null}
      <Button
        block
        loading={Boolean(selected && buying === selected.productId)}
        disabled={Boolean(buying) || !selected || !enabled || !subscriber}
        onClick={() => selected && onBuy(selected)}
      >
        {!subscriber
          ? t('wallet.subscriberOnly')
          : t('subscription.buyPointsCard', {
              price: selected ? (selected.goodsPrice / 100).toFixed(2) : '--',
            })}
      </Button>
    </View>
  )
}

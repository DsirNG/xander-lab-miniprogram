import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import { t } from '@/i18n'

export function SkeletonBlock({
  width = '100%',
  height = '14px',
  circle = false,
}: {
  width?: string
  height?: string
  circle?: boolean
}) {
  return <View className={`sk-block ${circle ? 'sk-circle' : ''}`} style={{ width, height }} />
}

const B = SkeletonBlock

function Stack({ children }: { children: ReactNode }) {
  return <View className="sk-stack">{children}</View>
}

function Row({ children }: { children: ReactNode }) {
  return <View className="sk-row">{children}</View>
}

function Repeat({ count, children }: { count: number; children: ReactNode }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <View key={index}>{children}</View>
      ))}
    </>
  )
}

function ArticleRows({ count, manage }: { count: number; manage: boolean }) {
  return (
    <Repeat count={count}>
      <View className="sk-list-item">
        <Stack>
          <B width="75%" height="18px" />
          <B width="94%" />
          <B width="65%" />
          <Row>
            <B width="58px" height="20px" />
            <B width="84px" />
            <B width="44px" />
          </Row>
          {manage && (
            <Row>
              <B width="48px" height="24px" />
              <B width="65px" height="24px" />
            </Row>
          )}
        </Stack>
      </View>
    </Repeat>
  )
}

function FormFields({ count }: { count: number }) {
  return (
    <Repeat count={count}>
      <Stack>
        <B width="72px" height="12px" />
        <B height="42px" />
      </Stack>
    </Repeat>
  )
}

const layouts = {
  images: (count: number) => (
    <View className="sk-grid">
      <Repeat count={count}>
        <View className="sk-block sk-tile" />
      </Repeat>
    </View>
  ),
  articleFilters: () => (
    <Row>
      <B width="54px" height="30px" />
      <B width="70px" height="30px" />
      <B width="62px" height="30px" />
    </Row>
  ),
  articles: (count: number) => <ArticleRows count={count} manage={false} />,
  blogManage: (count: number) => <ArticleRows count={count} manage />,
  articleDetail: () => (
    <>
      <B width="91%" height="32px" />
      <Row>
        <B width="28px" height="28px" circle />
        <B width="108px" />
        <B width="72px" />
      </Row>
      <Row>
        <B width="64px" height="22px" />
        <B width="48px" height="22px" />
      </Row>
      <Stack>
        <B />
        <B />
        <B width="82%" />
        <B />
        <B width="60%" />
      </Stack>
    </>
  ),
  plans: (count: number) => (
    <Repeat count={count}>
      <View className="sk-list-item">
        <Stack>
          <Row>
            <B width="62%" height="18px" />
            <B width="55px" height="20px" />
          </Row>
          <B width="76%" />
          <B width="48%" />
        </Stack>
      </View>
    </Repeat>
  ),
  planDetail: () => (
    <>
      <B width="72%" height="28px" />
      <Row>
        <B width="68px" height="24px" />
        <B width="96px" />
      </Row>
      <View className="sk-list-item">
        <Stack>
          <B width="45%" />
          <B width="78%" />
          <B width="62%" />
          <B width="90%" />
        </Stack>
      </View>
      <B width="38%" height="19px" />
    </>
  ),
  planRuns: (count: number) => (
    <Repeat count={count}>
      <View className="sk-list-item">
        <Stack>
          <Row>
            <B width="60%" height="17px" />
            <B width="56px" height="20px" />
          </Row>
          <B width="46%" />
        </Stack>
      </View>
    </Repeat>
  ),
  planItems: (count: number) => (
    <Repeat count={count}>
      <Row>
        <B width="20px" height="20px" />
        <B width="72%" />
        <B width="28px" />
      </Row>
    </Repeat>
  ),
  planForm: () => (
    <>
      <FormFields count={3} />
      <B height="94px" />
      <Row>
        <B width="42%" height="36px" />
        <B width="42%" height="36px" />
      </Row>
    </>
  ),
  publishForm: () => (
    <>
      <FormFields count={3} />
      <B height="160px" />
      <Row>
        <B width="45%" height="40px" />
        <B width="45%" height="40px" />
      </Row>
    </>
  ),
  notifications: (count: number) => (
    <Repeat count={count}>
      <View className="sk-list-item">
        <Row>
          <B width="36px" height="36px" circle />
          <Stack>
            <B width="58%" height="16px" />
            <B width="95%" />
            <B width="38%" height="11px" />
          </Stack>
        </Row>
      </View>
    </Repeat>
  ),
  balance: () => (
    <Stack>
      <B width="92px" height="31px" />
      <B width="75px" height="12px" />
    </Stack>
  ),
  ledger: (count: number) => (
    <Repeat count={count}>
      <View className="sk-list-item">
        <Row>
          <Stack>
            <B width="64%" height="16px" />
            <B width="46%" height="11px" />
          </Stack>
          <B width="56px" height="18px" />
        </Row>
      </View>
    </Repeat>
  ),
  subscription: (count: number) => (
    <Repeat count={count}>
      <View className="sk-list-item">
        <Stack>
          <B width="46%" height="20px" />
          <B width="84%" />
          <B width="30%" height="26px" />
          <B height="38px" />
        </Stack>
      </View>
    </Repeat>
  ),
  account: () => (
    <>
      <Row>
        <B width="54%" />
        <B width="56px" height="56px" circle />
      </Row>
      <Repeat count={2}>
        <View className="sk-list-item">
          <Row>
            <B width="34%" />
            <B width="33%" />
          </Row>
        </View>
      </Repeat>
    </>
  ),
  security: () => (
    <>
      <View className="sk-list-item">
        <Stack>
          <B width="34%" />
          <B width="55%" height="12px" />
        </Stack>
      </View>
      <Repeat count={2}>
        <View className="sk-list-item">
          <Row>
            <B width="38%" />
            <B width="14px" height="14px" />
          </Row>
        </View>
      </Repeat>
    </>
  ),
  profile: () => (
    <Row>
      <B width="56px" height="56px" circle />
      <Stack>
        <B width="52%" height="22px" />
        <B width="38%" height="12px" />
      </Stack>
    </Row>
  ),
  profileValue: () => <B width="48px" height="14px" />,
  recitation: (count: number) => (
    <Repeat count={count}>
      <View className="sk-list-item">
        <Stack>
          <B width="62%" height="20px" />
          <B width="96%" />
          <B width="73%" />
          <Row>
            <B width="50%" height="32px" />
            <B width="42%" height="32px" />
          </Row>
        </Stack>
      </View>
    </Repeat>
  ),
  recitationHistory: (count: number) => (
    <Repeat count={count}>
      <View className="sk-list-item">
        <Row>
          <Stack>
            <B width="56%" />
            <B width="36%" height="11px" />
          </Stack>
          <B width="55px" height="25px" />
        </Row>
      </View>
    </Repeat>
  ),
  recitationPractice: () => (
    <>
      <B width="60%" height="23px" />
      <View className="sk-list-item">
        <Stack>
          <B />
          <B />
          <B width="79%" />
          <B width="90%" />
          <B width="52%" />
        </Stack>
      </View>
      <Row>
        <B width="48%" height="44px" />
        <B width="48%" height="44px" />
      </Row>
    </>
  ),
  recitationReport: () => (
    <>
      <View className="sk-score">
        <B width="90px" height="17px" />
        <B width="100px" height="52px" />
      </View>
      <Row>
        <B width="31%" height="60px" />
        <B width="31%" height="60px" />
        <B width="31%" height="60px" />
      </Row>
      <View className="sk-list-item">
        <Stack>
          <B width="40%" height="18px" />
          <B />
          <B width="70%" />
        </Stack>
      </View>
    </>
  ),
  conversations: (count: number) => (
    <Repeat count={count}>
      <Row>
        <B width="20px" height="20px" />
        <Stack>
          <B width="68%" />
          <B width="35%" height="10px" />
        </Stack>
        <B width="29px" height="11px" />
      </Row>
    </Repeat>
  ),
  messages: () => (
    <>
      <View className="sk-message sk-message--mine">
        <B width="100%" height="35px" />
      </View>
      <View className="sk-message">
        <Stack>
          <B />
          <B width="79%" />
          <B width="55%" />
        </Stack>
      </View>
      <View className="sk-message sk-message--mine">
        <B height="35px" />
      </View>
    </>
  ),
} satisfies Record<string, (count: number) => ReactNode>

export function Skeleton({ layout, count = 3 }: { layout: keyof typeof layouts; count?: number }) {
  return (
    <View className={`sk-layout sk-layout--${layout}`} aria-label={t('common.loading')}>
      {layouts[layout](count)}
    </View>
  )
}

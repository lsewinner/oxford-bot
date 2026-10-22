import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>确认邮箱 · {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Oxford Bot</Text>
        <Heading style={h1}>确认你的邮箱</Heading>
        <Text style={text}>
          感谢注册{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          请确认你的邮箱地址（
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ），点击下方按钮完成注册：
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          验证邮箱
        </Button>
        <Text style={footer}>
          如果你没有注册此账户，请忽略这封邮件。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Geist, Arial, PingFang SC, Microsoft YaHei, sans-serif' }
const brand = { fontSize: '14px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 32px' }
const container = { maxWidth: '520px', padding: '40px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid #000000',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #ffffff !important; color: #000000 !important; }
  }
  [data-ogsc] .dm-btn { background-color: #ffffff !important; color: #000000 !important; }
  [data-ogsb] .dm-btn { background-color: #ffffff !important; color: #000000 !important; }
`

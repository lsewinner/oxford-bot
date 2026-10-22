import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>重置密码 · {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Oxford Bot</Text>
        <Heading style={h1}>重置你的密码</Heading>
        <Text style={text}>
          我们收到了你的 {siteName} 密码重置申请。点击下方按钮设置新密码。
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          重置密码
        </Button>
        <Text style={footer}>
          如果你没有申请重置密码，请忽略这封邮件；你的密码不会改变。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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

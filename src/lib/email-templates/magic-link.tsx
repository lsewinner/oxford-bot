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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>登录链接 · {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Oxford Bot</Text>
        <Heading style={h1}>登录 Oxford Bot</Heading>
        <Text style={text}>
          点击下方按钮登录 {siteName}，请尽快使用此链接。
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          登录
        </Button>
        <Text style={footer}>
          如果你没有申请登录链接，请忽略这封邮件。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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

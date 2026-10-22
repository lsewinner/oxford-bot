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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>邀请你加入 {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Oxford Bot</Text>
        <Heading style={h1}>你收到了一份邀请</Heading>
        <Text style={text}>
          邀请你加入{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          。点击下方按钮接受邀请并创建账户。
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          接受邀请
        </Button>
        <Text style={footer}>
          如果你不认识此邀请，请忽略这封邮件。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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

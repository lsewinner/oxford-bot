import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="zh-CN" dir="ltr">
    <Head />
    <Preview>Oxford Bot 身份验证码</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Oxford Bot</Text>
        <Heading style={h1}>确认你的身份</Heading>
        <Text style={text}>请使用以下验证码确认你的身份：</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          请尽快使用此验证码，切勿与他人分享。如果不是你申请的，请忽略这封邮件。
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }

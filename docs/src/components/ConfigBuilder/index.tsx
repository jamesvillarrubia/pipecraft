import React from 'react'
import BrowserOnly from '@docusaurus/BrowserOnly'
import ConfigBuilder from './ConfigBuilder'

export default function ConfigBuilderWrapper() {
  return (
    <BrowserOnly fallback={<div>Loading configuration builder...</div>}>
      {() => <ConfigBuilder />}
    </BrowserOnly>
  )
}

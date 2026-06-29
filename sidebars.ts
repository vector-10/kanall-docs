import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    'quickstart',
    {
      type: 'category',
      label: 'Core Concepts',
      collapsed: false,
      items: [
        'concepts/tenants',
        'concepts/virtual-accounts',
        'concepts/ledger',
        'concepts/webhooks',
        'concepts/idempotency',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      collapsed: false,
      items: [
        'api-reference/authentication',
        'api-reference/accounts',
        'api-reference/statement',
        'api-reference/webhooks',
        'api-reference/errors',
      ],
    },
    {
      type: 'category',
      label: 'Tutorial: Logistics Integration',
      collapsed: false,
      items: [
        'tutorial/index',
        'tutorial/01-setup',
        'tutorial/02-provision-accounts',
        'tutorial/03-receive-payments',
        'tutorial/04-reconcile',
      ],
    },
  ],
}

export default sidebars

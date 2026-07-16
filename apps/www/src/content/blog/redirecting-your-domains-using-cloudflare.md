---
title: Redirecting Your Domains using Cloudflare
description: Learn how you can redirect your old domain to a new domain along with all sub-domains of your old domain just by using cloudflare for free
date: 2023-08-13
tags: dns, cloudflare, javascript, web-development
---

> I was not available for some time, so I haven't written about anything in a long time, recently I bought a [new domain](https://blankparticle.in) so I had to redirect my old domain and its subdomains to my new domain, This small blog is about how to do that.

I recently had to redirect my `.me` domain to `.in` domain, so I had to do Cloudflare domain redirects. Here is how to do it.

## Adding DNS Records

First, you need to add some **DNS Records**, follow this table and create new records or edit your existing records.

| Type | Name | Content   | Proxy Status | TTL  |
| ---- | ---- | --------- | ------------ | ---- |
| A    | `*`  | 192.0.2.1 | Proxied      | Auto |
| A    | `@`  | 192.0.2.1 | Proxied      | Auto |

> _You should not edit non-conflicting Records until you know what you are doing_

## Setting Up Page Rules

Once you have DNS setup, go to **Rules &gt; Page Rules**, Add a new rule with the config defined below,

URL: `*olddomain.com/*`  
Setting: Forwarding URL  
Status Code: `301` / `302`  
Destination URL: `https://$1newdomain.com/$2`

Now save the page rule and enable if already not enabled, This might take up to an hour to reflect on all devices due to DNS Caches.

## Effects

With this config all URLs and subdomains of `olddomain.com` will be redirected to `newdomain.com`

| From                                              | Redirected To                                     |
| ------------------------------------------------- | ------------------------------------------------- |
| `https://olddomain.com`                           | `https://newdomain.com`                           |
| `https://olddomain.com/anypage?with=query_string` | `https://newdomain.com/anypage?with=query_string` |
| `https://www.olddomain.com`                       | `https://www.newdomain.com`                       |
| `https://anything.olddomain.com`                  | `https://anything.newdomain.com`                  |

## Sources

- [Cloudflare Docs - Manage Domains](https://developers.cloudflare.com/fundamentals/get-started/basic-tasks/manage-domains/redirect-domain/)
- [Cloudflare Docs - Page Rules](https://developers.cloudflare.com/support/page-rules/configuring-url-forwarding-or-redirects-with-page-rules/)
- [Cloudflare Forum](https://community.cloudflare.com/t/redirecting-one-domain-to-another/81960)

**it's Blank Particle, Signing Out** 👋

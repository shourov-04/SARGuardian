# Datasets and references

This register distinguishes measurement products from catalogue services and visualization context.

## Primary NISAR measurement products

| Product | Official source | What it contains | How SARGuardian uses it |
|---|---|---|---|
| **NISAR L-band Level-2 GOFF — Geocoded Pixel Offsets** | [ASF GOFF Product Guide](https://nisar-docs.asf.alaska.edu/goff/) | Geocoded along-track and slant-range pixel-offset observations from compatible acquisitions | Find Displacements, Glacier Movement, and Known Place workflows use GOFF observations for spatial offset/candidate analysis. |
| **NISAR L-band Level-2 GUNW — Geocoded Unwrapped Interferogram** | [ASF GUNW Product Guide](https://nisar-docs.asf.alaska.edu/gunw/) | Geocoded unwrapped interferometric phase and associated product metadata | Used for pairwise phase and Line-of-Sight diagnostic analysis where product geometry, coherence, and valid-pixel support permit. Kept separate from GOFF. |
| **NISAR L-band Level-2 GCOV — Geocoded Polarimetric Covariance** | [ASF GCOV Product Guide](https://nisar-docs.asf.alaska.edu/gcov/) | Geocoded polarimetric covariance/backscatter observations and associated metadata | RiverShift processes compatible multi-date GCOV observations to screen newly water-covered areas and persistent land–water transitions. |

## Product discovery and access services

| Service | Official reference | Role in SARGuardian |
|---|---|---|
| **NASA Common Metadata Repository (CMR)** | [CMR Search API](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html) | Catalogue search for NISAR granules matching the requested AOI, product family, and observation window. |
| **Alaska Satellite Facility (ASF) DAAC** | [NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/) · [Product Overview](https://nisar-docs.asf.alaska.edu/products-overview/) | NISAR product documentation, availability information, metadata, and product access. |
| **NASA Earthdata / Earthaccess** | [ASF Earthaccess guide](https://nisar-docs.asf.alaska.edu/earthaccess/) | Access guidance for available NISAR data products and authenticated product retrieval. |

Catalogue discovery and product processing are separate operations. A catalogue result identifies a candidate source granule; the processing workflow performs the product-level and AOI-specific checks.

## Third-party visualization context

| Service | Official reference | Role |
|---|---|---|
| **Google Maps Platform — Maps JavaScript API** | [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview) | Interactive map display, place search, AOI drawing, geographic orientation, and result-layer visualization. It is map context, not a source of SARGuardian displacement or RiverShift measurements. |

## Scientific and mission references

1. [NASA — NISAR Mission Overview](https://science.nasa.gov/mission/nisar/mission-overview/)
2. [NASA — NISAR Observation Strategy](https://science.nasa.gov/mission/nisar/observation-strategy/)
3. [ASF — NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/)
4. [ASF — NISAR Products Overview](https://nisar-docs.asf.alaska.edu/products-overview/)
5. [ASF — GOFF Product Guide](https://nisar-docs.asf.alaska.edu/goff/)
6. [ASF — GUNW Product Guide](https://nisar-docs.asf.alaska.edu/gunw/)
7. [ASF — GCOV Product Guide](https://nisar-docs.asf.alaska.edu/gcov/)

## Project and development references

- [SARGuardian live application](https://sarguardian.vercel.app/)
- [Primary public source repository](https://github.com/shourov-04/SARGuardian)
- [GitHub Actions processing and validation history](https://github.com/shourov-04/SARGuardian/actions)
- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code)
- [OpenAI Codex resources](https://developers.openai.com/codex)
- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [ChatGPT](https://chatgpt.com/)
- [Google Gemini](https://gemini.google.com/)
- [Google AI Studio](https://aistudio.google.com/)
- [Google Flow](https://labs.google/fx/tools/flow)
- [CapCut](https://www.capcut.com/)

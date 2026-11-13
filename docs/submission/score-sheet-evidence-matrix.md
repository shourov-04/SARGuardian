# SARGuardian — score-sheet evidence matrix

**Challenge:** NASA Space Apps 2026 — Dancing with the SARs  
**Category:** Earth Science  
**Primary repository:** [shourov-04/SARGuardian](https://github.com/shourov-04/SARGuardian)  
**Live application:** https://sarguardian.vercel.app/

This matrix follows the supplied local judging score sheet. The five headline criteria total 100 points. Teamwork, User Experience, and NASA Data Usage contribute 15 points; Challenge Category, Repository Access, and Project Page Completion contribute 3 more, for 18 additional points. The score sheet also specifies a +5% aggregate bonus for teams with one or more women members.

## Headline criteria — 100 points

| Criterion | Maximum | SARGuardian evidence for review | Where to inspect |
|---|---:|---|---|
| **Impact** | 20 | Four user-facing workflows address surface-change questions across slopes, glacier terrain, known locations, and river systems. AOI/date-driven analysis allows reviewers to explore locations of their choice using compatible NISAR observations. | Live app; [Project overview](PROJECT_OVERVIEW.md); [RiverShift guide](../../engines/river-shift/tools/river_shift/NASA_SPACE_APPS_2026_JUDGE_GUIDE.md) |
| **Creativity** | 20 | Target-free AOI-wide candidate discovery; separate two-polygon Known Place analysis; independent GCOV RiverShift workflow; observed-date playback; source-linked result review; distinct user-facing analysis categories in one application. | [Web workflow cards](../../apps/web/src/pages/Home.tsx); [Find Displacements](../../engines/find-displacements/); [Known Place](../../engines/known-place/); [RiverShift](../../engines/river-shift/) |
| **Validity** | 20 | Product-specific processing; distinct GOFF/GUNW/GCOV contracts; AOI and acquisition compatibility checks; native-layer and valid-raster checks; processing manifests; checksums and provenance; automated engine and web tests; workflow-stage records. | [Scientific methods](SCIENTIFIC_METHODS.md); [engine code](../../engines/); [Actions history](https://github.com/shourov-04/SARGuardian/actions); [secret scan](../security/secret-scanning.md) |
| **Relevance** | 20 | NISAR L-band Level-2 observations are the central measurement inputs. GOFF, GUNW, and GCOV are used for distinct and complementary surface-change investigations aligned with Dancing with the SARs. | [Datasets and references](DATASETS_AND_REFERENCES.md); [production engine source](../../engines/); [supplementary NISAR detectability research](../../science/nisar-core/README.md) |
| **Presentation** | 20 | Public live application; guided workflow selection; AOI map interaction; processing and result views; layered RiverShift presentation; product/provenance context; video presentation; concise reviewer entry path and source-linked technical documentation. | [Live app](https://sarguardian.vercel.app/); [Reviewer guide](REVIEWER_GUIDE.md); [root README](../../README.md) |

## Additional criteria — 18 points

| Criterion | Maximum | Evidence to inspect |
|---|---:|---|
| **Teamwork** | 5 | Team member roles and responsibilities in the root README, current contributor graph, and source commit history. [Contributors](https://github.com/shourov-04/SARGuardian/graphs/contributors) |
| **User Experience** | 5 | Workflow cards, place search/AOI drawing, date selection, clear processing stages, maps, observed-date result navigation, and user-facing evidence panels. [Live app](https://sarguardian.vercel.app/) |
| **NASA Data Usage** | 5 | NISAR GOFF, GUNW, and GCOV product families as primary scientific inputs; NASA CMR/ASF for discovery and access; Google Maps as third-party geographic visualization context. [Dataset register](DATASETS_AND_REFERENCES.md) |
| **Challenge category identified** | 1 | “Dancing with the SARs” and “Earth Science” are identified in the root README and project documents. |
| **Repository access** | 1 | Public source repository is accessible without authentication. [Primary repository](https://github.com/shourov-04/SARGuardian) |
| **Project page complete** | 1 | Review the submitted NASA Space Apps project page and its links/media in the official submission interface. |

**Women participation bonus:** The supplied score sheet specifies **+5% on the aggregate** for teams with one or more women members. Apply this only where the official team roster meets the score sheet's eligibility condition.

## Verification links for reviewers

| Evidence | Verified result |
|---|---|
| [API CI](https://github.com/shourov-04/SARGuardian/actions/runs/43445529920) | API imports, 242 tests and Google Maps adapter contract passed |
| [Web CI](https://github.com/shourov-04/SARGuardian/actions/runs/43440412219) | Production build, lint and 182 tests across 22 files passed |
| [Historical secret scan](https://github.com/shourov-04/SARGuardian/actions/runs/43446585245) | Full Git-history Gitleaks scan passed |
| [Find Displacements example](https://github.com/shourov-04/SARGuardian/actions/runs/43443025783) | 16/16 selected products validated; 697 spatial candidate features and 27 AOI-wide screening candidates. Neither movement nor hazard was confirmed; common GUNW temporal inversion was withheld by its science gates. |
| [Known Place example](https://github.com/shourov-04/SARGuardian/actions/runs/43437706667) | Generic two-polygon workflow completed successfully |
| [RiverShift example](https://github.com/shourov-04/SARGuardian/actions/runs/43342470568) | 10 selected GCOV dates; 72 result artifacts; verified private publication; PROVISIONAL release status |

The example run links are reproducibility and processing evidence only. They must not be presented as global validation metrics or a substitute for an independent geophysical comparison. Judges are invited to run the live application with their own AOI and observation window.

## Scientific evidence presentation

### Find Displacements and Glacier Movement
Show the AOI, selected observation period, exact GOFF/GUNW product family, acquisition dates, candidate map, and per-product measurement context. Glacier Movement is the glacier-oriented category using the shared displacement workflow.

### Known Place Analysis
Show the Measurement Polygon and Reference Polygon separately. Keep generic AOI analysis and the author-exact P05023 research route distinct. The Bhote Koshi benchmark uses five author-selected P05023 GOFF pairs over 26 July–19 August 2026, with an approximately 0.96 m median offset magnitude and a descriptive rate of about 4.02 cm/day for that case.

### RiverShift
Show the selected river AOI, actual GCOV acquisition dates, source granule identifiers, colour-layer definitions, processing manifest, and raster QA context. Blue represents newly water-covered/open-water candidates; red represents persistent land-to-water candidates; green represents persistent water-to-land candidates.

## Evidence-reading principles

- A product catalogue match is discovery evidence; the worker's processing record is analysis evidence.
- GOFF offsets, GUNW phase/LOS, and GCOV covariance/backscatter must retain their distinct measurement meanings.
- Workflow status, source provenance, software tests, and independent geophysical comparison are separate forms of evidence.
- The best-supported interpretation is the one tied to the exact AOI, products, acquisition dates, and result manifest.

## Reviewer reading sequence

1. Open the live application and explore a workflow.
2. Read the [project overview](PROJECT_OVERVIEW.md).
3. Inspect the [dataset register](DATASETS_AND_REFERENCES.md) and [scientific methods](SCIENTIFIC_METHODS.md).
4. Follow the [reviewer guide](REVIEWER_GUIDE.md) into the exact implementation and Actions history.
5. Use the official score sheet categories above when assigning marks.

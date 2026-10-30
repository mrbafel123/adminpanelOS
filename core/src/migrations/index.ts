import * as migration_20261029_132336_initial from './20261029_132336_initial'
import * as migration_20261029_135307_modules_forms from './20261029_135307_modules_forms'
import * as migration_20261030_060011_modules_seo_redirects_legal from './20261030_060011_modules_seo_redirects_legal'

export const migrations = [
  {
    up: migration_20261029_132336_initial.up,
    down: migration_20261029_132336_initial.down,
    name: '20261029_132336_initial',
  },
  {
    up: migration_20261029_135307_modules_forms.up,
    down: migration_20261029_135307_modules_forms.down,
    name: '20261029_135307_modules_forms',
  },
  {
    up: migration_20261030_060011_modules_seo_redirects_legal.up,
    down: migration_20261030_060011_modules_seo_redirects_legal.down,
    name: '20261030_060011_modules_seo_redirects_legal',
  },
]

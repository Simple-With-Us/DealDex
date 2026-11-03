# Shared Brand Sources

This folder holds the owner-supplied DealDex artwork used to produce iOS, Android and web resources.  App resource catalogs and the web's served files stay with their build targets.

Run `python3 scripts/generate-app-icons.py` from the repository root to resize the approved launcher and isolated DD mark into `apps/ios`, `apps/android` and `public`.  The generator requires Pillow on demand; generated resources remain committed.

`owner-source/` retains the supplied originals and their provenance.  `icon-options/` retains older previews with its own archive explanation; those previews are not build inputs.

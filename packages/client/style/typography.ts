// src/styles/typography.ts

import { TypographyVariantsOptions } from '@mui/material';

// THE NEW ADDITION: Define and export the title font stack as a constant.
export const logoFontFamily = ['"Bemirs Demo"', '"Foglihtenno"', '"Ipanema Secco"', 'cursive'].join(',');

export const titleFontFamily = ['"Y Universe"', '"Cafe24ClassicType"', 'cursive'].join(',');

export const typography: TypographyVariantsOptions = {
  fontSize: 14,
  // Default body font
  fontFamily: [
    // 'HakgyoansimBareondotum',
    'Pretendard Variable',
    'Pretendard',
    '-apple-system',
    'BlinkMacSystemFont',
    'system-ui',
    'Roboto',
    '"Helvetica Neue"',
    'sans-serif',
  ].join(','),

  // Theme variants now use the exported constant for consistency.
  h1: { fontFamily: logoFontFamily, fontWeight: 700 },
  h2: { fontFamily: logoFontFamily, fontWeight: 700 },
  h3: { fontFamily: logoFontFamily, fontWeight: 700 },
  h4: { fontFamily: logoFontFamily, fontWeight: 400 },
  h5: { fontFamily: titleFontFamily, fontWeight: 400 },
  h6: { fontFamily: titleFontFamily, fontWeight: 400 },
  subtitle1: { fontFamily: titleFontFamily },
};

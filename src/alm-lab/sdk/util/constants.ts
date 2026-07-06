export const Constants = {
  APP_XML: 'application/xml',
  APP_JSON: 'application/json',
  ONE: '1',
  TESTSET: 'Test Set',
  BUILD_VERIFICATION_SUITE: 'Build Verification Suite',
  NO_RUN_ID: 'No Run ID',
  COMMA: ',',
  TEST_SET: 'TEST_SET',
  BVS: 'BVS',
  EQUAL: '=',
  SEMICOLON: ';'
} as const;

export type LabRunType = typeof Constants.TEST_SET | typeof Constants.BVS;

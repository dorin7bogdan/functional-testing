export enum ResxAccessLevel {
  PUBLIC = 'PUBLIC',
  PROTECTED = 'PROTECTED',
  PRIVATE = 'PRIVATE'
}

export const resxAccessHeaderName = (level: ResxAccessLevel): string | undefined => {
  if (level === ResxAccessLevel.PROTECTED) {
    return 'PtAL';
  }
  if (level === ResxAccessLevel.PRIVATE) {
    return 'PvAL';
  }
  return undefined;
};

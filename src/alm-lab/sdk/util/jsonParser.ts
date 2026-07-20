export type EntityMap = Record<string, string>;

import Logger from '../../../utils/logger.js';

const logger = new Logger('JsonParser');

const parseJsonPayload =  (payload: string): any => {
//logger.debug('parseJsonPayload ...');
try {
  const obj = JSON.parse(payload);
  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid JSON payload');
  }
    return obj;
  } catch (error: any) {
    throw new Error(`parseJsonPayload error: ${error?.message ?? error}`);
  }
};

const getDirectEntities = (parent: any): any[] => {
  //logger.debug(`getDirectEntities ...`);
  if (!parent || typeof parent !== 'object') {
    return [];
  }
  return Array.isArray(parent.entities) ? parent.entities : [];
};

const getFieldValue = (field: any): string => {
  //logger.debug(`getFieldValue: "${field?.Name ?? ''}"`);
  const values = Array.isArray(field?.values) ? field.values : [];
  const first = values[0];
  const value = first?.value;
  return typeof value === 'string' ? value.trim() : '';
};

const getEntityFields = (root: any): any[] => {
  //logger.debug('getEntityFields ...');
  const entity = root?.Entity ?? root;
  const fields = entity?.Fields?.Field ?? entity?.Fields;
  return Array.isArray(fields) ? fields : [];
};

export default class JsonParser {
  public static getAttrVal(json: string, attrName: string): string {
    //logger.debug(`getAttrVal: "${attrName}"`);
    const root = parseJsonPayload(json);
    const rootFields = getEntityFields(root);
    for (const field of rootFields) {
      if (String(field?.Name ?? '') === attrName) {
        return String(field.Value ?? getFieldValue(field));
      }
    }

    return '';
  }

  public static toEntities(json: string): EntityMap[] {
    logger.debug('toEntities ...');
    const root = parseJsonPayload(json);
    const entities = getDirectEntities(root);
    const list: EntityMap[] = [];

    for (const entity of entities) {
      const newEntity: EntityMap = {};
      const fields = getEntityFields(entity);
      for (const field of fields) {
        const key = field?.Name ?? '';
        if (key) {
          newEntity[key] = field.Value ?? getFieldValue(field);
        }
      }
      list.push(newEntity);
    }
    logger.debug(`toEntities: returning ${list.length} entities`);
    return list;
  }

  public static hasResults(json: string): boolean {
    const root = parseJsonPayload(json);

    const totalResultsRaw = root?.TotalResults;
    if (totalResultsRaw !== undefined && totalResultsRaw !== null) {
      const totalResults = Number.parseInt(String(totalResultsRaw), 10);
      if (!Number.isNaN(totalResults)) {
        logger.debug(`hasResults: TotalResults=${totalResults}`);
        return totalResults > 0;
      }
    }

    const entities = getDirectEntities(root);
    logger.debug(`hasResults: entities.length=${entities.length}`);
    return entities.length > 0;
  }

  public static getTestSetIds(json: string): number[] {
    logger.debug('getTestSetIds ...');
    const ids: number[] = [];
    const root = parseJsonPayload(json);
    const entities = getDirectEntities(root);

    for (const entity of entities) {
      const fields = getEntityFields(entity);
      for (const field of fields) {
        const fieldName = String(field?.Name ?? '').toLowerCase();
        if (fieldName === 'cycle-id') {
          const id = Number.parseInt(getFieldValue(field), 10);
          if (!Number.isNaN(id)) {
            ids.push(id);
          }
        }
      }
    }
    logger.debug(`getTestSetIds: [${ids.join(', ')}]`);
    return ids;
  }
}

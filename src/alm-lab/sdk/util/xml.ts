export type EntityMap = Record<string, string>;

import { DOMParser } from '@xmldom/xmldom';
import Logger from '../../../utils/logger.js';

type XmlElement = any;

const logger = new Logger('Xml');

const parseXmlDocument = (xml: string): XmlElement => {
  logger.debug('parseXmlDocument ...');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (!doc.documentElement) {
    throw new Error('Failed to parse xml document');
  }

  const parseErrors = doc.getElementsByTagName('parsererror');
  if (parseErrors.length > 0) {
    throw new Error(parseErrors[0].textContent ?? 'Failed to parse xml document');
  }

  return doc.documentElement;
};

const getDirectChildrenByTagName = (parent: XmlElement, name: string): XmlElement[] => {
  logger.debug(`getDirectChildrenByTagName: parent="${parent.tagName}", name="${name}"`);
  const children: XmlElement[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes.item(i);
    if (child.nodeType === 1 && child.tagName === name) {
      children.push(child);
    }
  }
  return children;
};

const getDirectChildByTagName = (parent: XmlElement, name: string): XmlElement | undefined => {
  logger.debug(`getDirectChildByTagName: parent="${parent.tagName}", name="${name}"`);
  return getDirectChildrenByTagName(parent, name)[0];
};

const getFieldValue = (field: XmlElement): string => {
  logger.debug(`getFieldValue: "${field.getAttribute('Name')}"`);
  const valueNode = getDirectChildByTagName(field, 'Value');
  return valueNode?.textContent?.trim() ?? '';
};

const getEntityFieldElements = (entity: XmlElement): XmlElement[] => {
  logger.debug(`getEntityFieldElements: "${entity.tagName}"`);
  const fieldsNode = getDirectChildByTagName(entity, 'Fields');
  if (!fieldsNode) {
    return [];
  }
  return getDirectChildrenByTagName(fieldsNode, 'Field');
};

export default class Xml {
  public static getAttributeValue(xml: string, attrName: string): string {
    logger.debug(`getAttributeValue: "${attrName}"`);
    const root = parseXmlDocument(xml);
    const rootFields = getEntityFieldElements(root);
    for (const field of rootFields) {
      if (field.getAttribute('Name') === attrName) {
        return getFieldValue(field);
      }
    }

    return '';
  }

  public static toEntities(xml: string): EntityMap[] {
    logger.debug('toEntities ...');
    const root = parseXmlDocument(xml);
    const entities = getDirectChildrenByTagName(root, 'Entity');
    const list: EntityMap[] = [];

    for (const entity of entities) {
      const newEntity: EntityMap = {};
      const fields = getEntityFieldElements(entity);
      for (const field of fields) {
        const key = field.getAttribute('Name');
        if (!key) {
          continue;
        }
        newEntity[key] = getFieldValue(field);
      }
      list.push(newEntity);
    }

    return list;
  }

  public static hasResults(xml: string): boolean {
    logger.debug('hasResults ...');
    const root = parseXmlDocument(xml);
    const totalResults = root.getAttribute('TotalResults');
    if (totalResults !== null) {
      return Number.parseInt(totalResults, 10) > 0;
    }
    return getDirectChildrenByTagName(root, 'Entity').length > 0;
  }

  public static getTestSetIds(xml: string): number[] {
    logger.debug('getTestSetIds ...');
    const ids: number[] = [];
    const root = parseXmlDocument(xml);
    const entities = getDirectChildrenByTagName(root, 'Entity');

    for (const entity of entities) {
      const fields = getEntityFieldElements(entity);
      for (const field of fields) {
        if (field.getAttribute('Name') === 'cycle-id') {
          const id = Number.parseInt(getFieldValue(field), 10);
          if (!Number.isNaN(id)) {
            ids.push(id);
          }
        }
      }
    }

    return ids;
  }
}

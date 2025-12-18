import type { Schema, Struct } from '@strapi/strapi';

export interface AttributesAddressAttributes extends Struct.ComponentSchema {
  collectionName: 'components_attributes_address_attributes';
  info: {
    displayName: 'address_attributes';
    icon: 'train';
  };
  attributes: {
    additionalInfo: Schema.Attribute.Blocks;
    city: Schema.Attribute.String & Schema.Attribute.Required;
    country: Schema.Attribute.String & Schema.Attribute.Required;
    postalCode: Schema.Attribute.String & Schema.Attribute.Required;
    state: Schema.Attribute.String & Schema.Attribute.Required;
    street: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface AttributesItems extends Struct.ComponentSchema {
  collectionName: 'components_attributes_items';
  info: {
    displayName: 'items';
    icon: 'shoppingCart';
  };
  attributes: {
    productos: Schema.Attribute.Relation<'oneToMany', 'api::producto.producto'>;
    quantity: Schema.Attribute.Decimal & Schema.Attribute.Required;
    subtotal: Schema.Attribute.Decimal;
    unitPrice: Schema.Attribute.Decimal;
  };
}

export interface AttributesProductAttributes extends Struct.ComponentSchema {
  collectionName: 'components_attributes_product_attributes';
  info: {
    displayName: 'product_attributes';
    icon: 'shirt';
  };
  attributes: {
    attributeName: Schema.Attribute.String & Schema.Attribute.Required;
    attributeValue: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface AttributesShippingAddress extends Struct.ComponentSchema {
  collectionName: 'components_attributes_shipping_addresses';
  info: {
    displayName: 'shipping_address';
    icon: 'priceTag';
  };
  attributes: {
    additionalInfo: Schema.Attribute.String;
    city: Schema.Attribute.String & Schema.Attribute.Required;
    country: Schema.Attribute.String & Schema.Attribute.Required;
    phone: Schema.Attribute.String & Schema.Attribute.Required;
    postalCode: Schema.Attribute.String & Schema.Attribute.Required;
    state: Schema.Attribute.String & Schema.Attribute.Required;
    street: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'attributes.address-attributes': AttributesAddressAttributes;
      'attributes.items': AttributesItems;
      'attributes.product-attributes': AttributesProductAttributes;
      'attributes.shipping-address': AttributesShippingAddress;
    }
  }
}

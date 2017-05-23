﻿import { ListPicker as ListPickerDefinition, ItemsSource } from ".";
import { View, Property, CoercibleProperty } from "../core/view";

export * from "../core/view";

export class ListPickerBase extends View implements ListPickerDefinition {

    public selectedIndex: number;
    public items: any[] | ItemsSource;
    public isItemsSource: boolean;

    public _getItemAsString(index: number): any {
        let items = this.items;
        if (!items) {
            return " ";
        }

        let item = this.isItemsSource ? (<ItemsSource>this.items).getItem(index) : this.items[index];
        return (item === undefined || item === null) ? index + "" : item + "";
    }
}

ListPickerBase.prototype.recycleNativeView = true;

export const selectedIndexProperty = new CoercibleProperty<ListPickerBase, number>({
    name: "selectedIndex", defaultValue: -1,
    valueConverter: (v) => parseInt(v),
    coerceValue: (target, value) => {
        let items = target.items;
        if (items) {
            let max = items.length - 1;
            if (value < 0) {
                value = 0;
            }
            if (value > max) {
                value = max;
            }
        } else {
            value = -1;
        }

        return value;
    }
});
selectedIndexProperty.register(ListPickerBase);

export const itemsProperty = new Property<ListPickerBase, any[] | ItemsSource>({
    name: "items", valueChanged: (target, oldValue, newValue) => {
        let getItem = newValue && (<ItemsSource>newValue).getItem;
        target.isItemsSource = typeof getItem === "function";
    }
});
itemsProperty.register(ListPickerBase);

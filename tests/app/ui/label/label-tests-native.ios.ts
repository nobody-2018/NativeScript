import * as labelModule from "tns-core-modules/ui/label";
import * as enums from "tns-core-modules/ui/enums";
import * as colorModule from "tns-core-modules/color";
import { getColor } from "../helper";

export function getNativeTextAlignment(label: labelModule.Label): string {
    switch (label.ios.textAlignment) {
        case NSTextAlignment.Left:
            return enums.TextAlignment.left;
        case NSTextAlignment.Center:
            return enums.TextAlignment.center;
        case NSTextAlignment.Right:
            return enums.TextAlignment.right;
        default:
            return "unexpected value";
    }
}

export function getNativeBackgroundColor(label: labelModule.Label): colorModule.Color {
    var uiColor = (<UILabel>label.ios).backgroundColor;
    return getColor(uiColor);
}

import { AndroidActionBarSettings as AndroidActionBarSettingsDefinition, AndroidActionItemSettings } from ".";
import { ActionItemBase, ActionBarBase, isVisible, View, colorProperty, Color } from "./action-bar-common";
import { RESOURCE_PREFIX } from "../../utils/utils";
import { fromFileOrResource } from "../../image-source";
import * as application from "../../application";

export * from "./action-bar-common";

const R_ID_HOME = 0x0102002c;
const ACTION_ITEM_ID_OFFSET = 10000;

let actionItemIdGenerator = ACTION_ITEM_ID_OFFSET;
function generateItemId(): number {
    actionItemIdGenerator++;
    return actionItemIdGenerator;
}

interface MenuItemClickListener {
    new (owner: ActionBar): android.support.v7.widget.Toolbar.OnMenuItemClickListener;
}

let appResources: android.content.res.Resources;
let MenuItemClickListener: MenuItemClickListener;

function initializeMenuItemClickListener(): void {
    if (MenuItemClickListener) {
        return;
    }

    @Interfaces([android.support.v7.widget.Toolbar.OnMenuItemClickListener])
    class MenuItemClickListenerImpl extends java.lang.Object implements android.support.v7.widget.Toolbar.OnMenuItemClickListener {
        constructor(public owner: ActionBar) {
            super();
            return global.__native(this);
        }

        onMenuItemClick(item: android.view.IMenuItem): boolean {
            let itemId = item.getItemId();
            return this.owner._onAndroidItemSelected(itemId);
        }
    }

    MenuItemClickListener = MenuItemClickListenerImpl;
    appResources = application.android.context.getResources();
}

export class ActionItem extends ActionItemBase {
    private _androidPosition: AndroidActionItemSettings = {
        position: "actionBar",
        systemIcon: undefined
    };

    private _itemId;
    constructor() {
        super();
        this._itemId = generateItemId();
    }

    public get android(): AndroidActionItemSettings {
        return this._androidPosition;
    }
    public set android(value: AndroidActionItemSettings) {
        throw new Error("ActionItem.android is read-only");
    }

    public _getItemId() {
        return this._itemId;
    }
}

export class AndroidActionBarSettings implements AndroidActionBarSettingsDefinition {
    private _actionBar: ActionBar;
    private _icon: string;
    private _iconVisibility: "auto" | "never" | "always" = "auto";

    constructor(actionBar: ActionBar) {
        this._actionBar = actionBar;
    }

    public get icon(): string {
        return this._icon;
    }
    public set icon(value: string) {
        if (value !== this._icon) {
            this._icon = value;
            this._actionBar._onIconPropertyChanged();
        }
    }

    public get iconVisibility(): "auto" | "never" | "always" {
        return this._iconVisibility;
    }
    public set iconVisibility(value: "auto" | "never" | "always") {
        if (value !== this._iconVisibility) {
            this._iconVisibility = value;
            this._actionBar._onIconPropertyChanged();
        }
    }
}

export class NavigationButton extends ActionItem {
    //
}

export class ActionBar extends ActionBarBase {
    private _android: AndroidActionBarSettings;
    public nativeView: android.support.v7.widget.Toolbar;

    constructor() {
        super();
        this._android = new AndroidActionBarSettings(this);
    }

    get android(): AndroidActionBarSettings {
        return this._android;
    }

    public _addChildFromBuilder(name: string, value: any) {
        if (value instanceof NavigationButton) {
            this.navigationButton = value;
        }
        else if (value instanceof ActionItem) {
            this.actionItems.addItem(value);
        }
        else if (value instanceof View) {
            this.titleView = value;
        }
    }

    public createNativeView() {
        initializeMenuItemClickListener();
        const toolbar = new android.support.v7.widget.Toolbar(this._context);
        const menuItemClickListener = new MenuItemClickListener(this);
        toolbar.setOnMenuItemClickListener(menuItemClickListener);
        (<any>toolbar).menuItemClickListener = menuItemClickListener;
        return toolbar;
    }

    public initNativeView(): void {
        super.initNativeView();
        (<any>this.nativeView).menuItemClickListener.owner = this;
    }

    public disposeNativeView() {
        (<any>this.nativeView).menuItemClickListener.owner = null;
        super.disposeNativeView();
    }

    public onLoaded() {
        super.onLoaded();
        this.update();
    }

    public update() {
        if (!this.nativeView) {
            return;
        }

        const page = this.page;
        if (!page.frame || !page.frame._getNavBarVisible(page)) {
            this.nativeView.setVisibility(android.view.View.GONE);

            // If action bar is hidden - no need to fill it with items.
            return;
        }

        this.nativeView.setVisibility(android.view.View.VISIBLE);

        // Add menu items
        this._addActionItems();

        // Set title
        this._updateTitleAndTitleView();

        // Set home icon
        this._updateIcon();

        // Set navigation button
        this._updateNavigationButton();
    }

    public _onAndroidItemSelected(itemId: number): boolean {
        // Handle home button
        if (this.navigationButton && itemId === R_ID_HOME) {
            this.navigationButton._raiseTap();
            return true;
        }

        // Find item with the right ID;
        let menuItem: ActionItem = undefined;
        let items = this.actionItems.getItems();
        for (let i = 0; i < items.length; i++) {
            if ((<ActionItem>items[i])._getItemId() === itemId) {
                menuItem = <ActionItem>items[i];
                break;
            }
        }

        if (menuItem) {
            menuItem._raiseTap();
            return true;
        }

        return false;
    }

    public _updateNavigationButton() {
        const navButton = this.navigationButton;
        if (navButton && isVisible(navButton)) {
            const systemIcon = navButton.android.systemIcon;
            if (systemIcon !== undefined) {
                // Try to look in the system resources.
                const systemResourceId = getSystemResourceId(systemIcon);
                if (systemResourceId) {
                    this.nativeView.setNavigationIcon(systemResourceId);
                }
            }
            else if (navButton.icon) {
                let drawableOrId = getDrawableOrResourceId(navButton.icon, appResources);
                this.nativeView.setNavigationIcon(drawableOrId);
            }

            let navBtn = new WeakRef(navButton);
            this.nativeView.setNavigationOnClickListener(new android.view.View.OnClickListener({
                onClick: function (v) {
                    let owner = navBtn.get();
                    if (owner) {
                        owner._raiseTap();
                    }
                }
            }));
        }
        else {
            this.nativeView.setNavigationIcon(null);
        }
    }

    public _updateIcon() {
        let visibility = getIconVisibility(this.android.iconVisibility);
        if (visibility) {
            let icon = this.android.icon;
            if (icon !== undefined) {
                let drawableOrId = getDrawableOrResourceId(icon, appResources);
                if (drawableOrId) {
                    this.nativeView.setLogo(drawableOrId);
                }
            }
            else {
                let defaultIcon = application.android.nativeApp.getApplicationInfo().icon;
                this.nativeView.setLogo(defaultIcon);
            }
        }
        else {
            this.nativeView.setLogo(null);
        }
    }

    public _updateTitleAndTitleView() {
        if (!this.titleView) {
            // No title view - show the title
            let title = this.title;
            if (title !== undefined) {
                this.nativeView.setTitle(title);
            } else {
                let appContext = application.android.context;
                let appInfo = appContext.getApplicationInfo();
                let appLabel = appContext.getPackageManager().getApplicationLabel(appInfo);
                if (appLabel) {
                    this.nativeView.setTitle(appLabel);
                }
            }
        }
    }

    public _addActionItems() {
        let menu = this.nativeView.getMenu();
        let items = this.actionItems.getVisibleItems();

        menu.clear();
        for (let i = 0; i < items.length; i++) {
            let item = <ActionItem>items[i];
            let menuItem = menu.add(android.view.Menu.NONE, item._getItemId(), android.view.Menu.NONE, item.text + "");

            if (item.actionView && item.actionView.android) {
                // With custom action view, the menuitem cannot be displayed in a popup menu. 
                item.android.position = "actionBar";
                menuItem.setActionView(item.actionView.android);
                ActionBar._setOnClickListener(item);
            }
            else if (item.android.systemIcon) {
                // Try to look in the system resources.
                let systemResourceId = getSystemResourceId(item.android.systemIcon);
                if (systemResourceId) {
                    menuItem.setIcon(systemResourceId);
                }
            }
            else if (item.icon) {
                let drawableOrId = getDrawableOrResourceId(item.icon, appResources);
                if (drawableOrId) {
                    menuItem.setIcon(drawableOrId);
                }
                else {
                    throw new Error("Error loading icon from " + item.icon);
                }
            }

            let showAsAction = getShowAsAction(item);
            menuItem.setShowAsAction(showAsAction);
        }
    }

    private static _setOnClickListener(item: ActionItem): void {
        item.actionView.android.setOnClickListener(new android.view.View.OnClickListener({
            onClick: function (v: android.view.View) {
                item._raiseTap();
            }
        }));
    }

    public _onTitlePropertyChanged() {
        if (this.nativeView) {
            this._updateTitleAndTitleView();
        }
    }

    public _onIconPropertyChanged() {
        if (this.nativeView) {
            this._updateIcon();
        }
    }

    public _addViewToNativeVisualTree(child: View, atIndex: number = Number.MAX_VALUE): boolean {
        super._addViewToNativeVisualTree(child);

        if (this.nativeView && child.nativeView) {
            if (atIndex >= this.nativeView.getChildCount()) {
                this.nativeView.addView(child.nativeView);
            }
            else {
                this.nativeView.addView(child.nativeView, atIndex);
            }
            return true;
        }

        return false;
    }

    public _removeViewFromNativeVisualTree(child: View): void {
        super._removeViewFromNativeVisualTree(child);

        if (this.nativeView && child.nativeView) {
            this.nativeView.removeView(child.nativeView);
        }
    }

    [colorProperty.getDefault](): number {
        if (!defaultTitleTextColor) {
            let textView = new android.widget.TextView(this._context);
            defaultTitleTextColor = textView.getTextColors().getDefaultColor();
        }

        return defaultTitleTextColor;
    }
    [colorProperty.setNative](value: number | Color) {
        let color = value instanceof Color ? value.android : value;
        this.nativeView.setTitleTextColor(color);
    }
}

ActionBar.prototype.recycleNativeView = true;

let defaultTitleTextColor: number;

function getDrawableOrResourceId(icon: string, resources: android.content.res.Resources): any {
    if (typeof icon !== "string") {
        return undefined;
    }

    if (icon.indexOf(RESOURCE_PREFIX) === 0) {
        let resourceId: number = resources.getIdentifier(icon.substr(RESOURCE_PREFIX.length), 'drawable', application.android.packageName);
        if (resourceId > 0) {
            return resourceId;
        }
    }
    else {
        let drawable: android.graphics.drawable.BitmapDrawable;

        let is = fromFileOrResource(icon);
        if (is) {
            drawable = new android.graphics.drawable.BitmapDrawable(is.android);
        }

        return drawable;
    }

    return undefined;
}

function getShowAsAction(menuItem: ActionItem): number {
    switch (menuItem.android.position) {
        case "actionBarIfRoom":
            return android.view.MenuItem.SHOW_AS_ACTION_IF_ROOM;

        case "popup":
            return android.view.MenuItem.SHOW_AS_ACTION_NEVER;

        case "actionBar":
        default:
            return android.view.MenuItem.SHOW_AS_ACTION_ALWAYS;
    }
}

function getIconVisibility(iconVisibility: string): boolean {
    switch (iconVisibility) {
        case "always":
            return true;

        case "auto":
        case "never":
        default:
            return false;
    }
}

function getSystemResourceId(systemIcon: string): number {
    return android.content.res.Resources.getSystem().getIdentifier(systemIcon, "drawable", "android");
}
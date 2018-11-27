import MyBooksCard from "readium-desktop/renderer/components/myBooks/MyBooksCard";
import MyBooksList from "readium-desktop/renderer/components/myBooks/MyBooksList";
import SettingsLanguages from "readium-desktop/renderer/components/settings/SettingsLanguages";
import SettingsTags from "readium-desktop/renderer/components/settings/SettingsTags";

import Catalog from "readium-desktop/renderer/components/catalog/Catalog";

interface Route {
    path: string;
    exact: boolean;
    title: string;
    component: any;
    customParams?: any;
}

interface RouteList {
    [path: string]: Route;
}

export const routes: RouteList = {
    "/myBooks/list": {
        path: "/myBooks/list",
        exact: false,
        title: "MyBooksList",
        component: Catalog,
    },
    "/settings/tags": {
        path: "/settings/tags",
        exact: false,
        title: "Settings: Tags",
        component: SettingsTags,
    },
    "/settings/languages": {
        path: "/settings/languages",
        exact: false,
        title: "Settings: Languages",
        component: SettingsLanguages,
    },
    "/settings": {
        path: "/settings",
        exact: false,
        title: "Settings: Tags",
        component: SettingsTags,
    },
    "/": {
        path: "/",
        exact: false,
        title: "Home",
        component: Catalog,
    },
};
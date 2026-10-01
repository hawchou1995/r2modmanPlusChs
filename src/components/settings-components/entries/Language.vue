<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { getStore } from '../../../providers/generic/store/StoreProvider';
import { State } from '../../../store';
import ManagerSettings from '../../../r2mm/manager/ManagerSettings';
import LocaleManager from '../../../r2mm/manager/LocaleManager';
import SettingsViewWrapper from '../SettingsViewWrapper.vue';
import { useSettingSearch } from '../../composables/SettingSearchComposable';
import { useI18n } from 'vue-i18n';
import messages, { availableLocaleKeys } from '../../../i18n';
import { i18n } from '../../../i18n/instance';

const store = getStore<State>();
const settings = ref<ManagerSettings | null>(null);
const locale = ref<string>(i18n.global.locale.value);

const props = defineProps<{
    searchTerm?: string;
}>();

const { t } = useI18n();

const { isVisible } = useSettingSearch(() => props.searchTerm, 'translations.pages.settings.entries.language.searchTerms');

const options = availableLocaleKeys.map((key) => ({
    key,
    name: messages[key].metadata.name,
}));

onMounted(async () => {
    settings.value = await ManagerSettings.getSingleton(store.state.activeGame);

    // A value stored by an older build (for example the pre-i18n "en-us") is not a
    // locale this build ships, so LocaleManager falls back to English. Mirror that
    // fallback here, otherwise the select matches no option and renders blank.
    const stored = settings.value.getContext().global.locale as string;
    locale.value = (availableLocaleKeys as readonly string[]).includes(stored)
        ? stored
        : i18n.global.locale.value;
});

async function setLocale(value: string) {
    locale.value = value;
    await LocaleManager.save(value);
}
</script>

<template>
    <SettingsViewWrapper v-show="isVisible">
        <template #title>{{ t('translations.pages.settings.entries.language.title') }}</template>
        <template #description>
            {{ t('translations.pages.settings.entries.language.description') }}
        </template>
        <select
            class="select"
            :value="locale"
            @change="setLocale(($event.target as HTMLSelectElement).value)"
        >
            <option v-for="option in options" :key="option.key" :value="option.key">
                {{ option.name }}
            </option>
        </select>
    </SettingsViewWrapper>
</template>

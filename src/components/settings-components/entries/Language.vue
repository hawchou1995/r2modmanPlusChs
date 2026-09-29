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

const store = getStore<State>();
const settings = ref<ManagerSettings | null>(null);
const locale = ref<string>(availableLocaleKeys[0]);

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
    locale.value = settings.value.getContext().global.locale;
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

// src/client/component/page/chat/AiModelSelector.tsx

import { alpha, FormControl, InputLabel, ListSubheader } from '@mui/material';
import { GlassMenuItem, GlassSelect } from '../../layout/component/glass/index.js';
import { glassEffect, glassEffectLight } from '../../style/glassEffect.js';
import { silver } from '../../style/colors.js';
import { LANG_KEYS, SELECTABLE_MODEL_INFO } from '@rita-berenice/shared/config';
import type { ModelCatalogEntry } from '@rita-berenice/shared/api';
import { getLangText } from '../../util/translateUtils.js';

type ModelOption = Pick<ModelCatalogEntry, 'id' | 'name' | 'platform' | 'provider'>;

const fallbackOptions: ModelOption[] = Object.entries(SELECTABLE_MODEL_INFO).flatMap(([platform, providers]) =>
  Object.entries(providers).flatMap(([provider, models]) =>
    models.map((id) => ({
      id,
      name: id.split('/').at(-1) ?? id,
      platform: platform as ModelOption['platform'],
      provider: provider as ModelOption['provider'],
    })),
  ),
);

const groupOptions = <K extends string>(
  options: ModelOption[],
  getKey: (option: ModelOption) => K,
): Map<K, ModelOption[]> => {
  const groups = new Map<K, ModelOption[]>();
  for (const option of options) {
    const key = getKey(option);
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  return groups;
};

export const AiModelSelector = ({
  modelName,
  onAiModel,
  models,
  disableMenuTransition = false,
  compact = false,
  disabled = false,
}: {
  modelName: string;
  onAiModel: (modelName: string) => void;
  models?: ModelCatalogEntry[];
  disableMenuTransition?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) => {
  const handleModelChange = (eventValue: string) => {
    onAiModel(eventValue);
  };
  const options = models?.length ? models : fallbackOptions;
  const groupedOptions = groupOptions(options, (option) => option.platform);
  const modelOptions = Array.from(groupedOptions.entries()).flatMap(([platform, platformModels]) => {
    // THE FIX: The platform header now has the prominent, uppercase style.
    const platformHeader = (
      <ListSubheader
        key={platform}
        disableSticky
        sx={(theme) => ({
          px: compact ? 1.5 : 2,
          pt: 0.5,
          fontSize: compact ? '0.7rem' : '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: theme.palette.primary.main,
          backgroundColor: alpha(theme.palette.background.default, 0.82),
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          lineHeight: '28px',
        })}
      >
        {platform}
      </ListSubheader>
    );

    const providerItems = Array.from(groupOptions(platformModels, (option) => option.provider).entries()).flatMap(
      ([provider, providerModels]) => {
        // THE FIX: The provider sub-header now has the subtler, italic style.
        const providerHeader = (
          <ListSubheader
            key={`${platform}-${provider}`}
            disableSticky
            sx={(theme) => ({
              px: compact ? 2 : 4,
              bgcolor: 'transparent',
              fontWeight: 600,
              fontSize: compact ? '0.7rem' : '0.8rem',
              lineHeight: '26px',
              textTransform: 'uppercase',
              color: theme.palette.text.secondary,
            })}
          >
            {provider}
          </ListSubheader>
        );

        const modelItems = providerModels.map((model) => (
          <GlassMenuItem
            key={model.id}
            value={model.id}
            sx={{
              pl: compact ? 2.5 : 6,
              pr: 1.5,
              py: 0.5,
              minHeight: compact ? 36 : undefined,
              fontSize: compact ? '0.875rem' : undefined,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {model.name}
          </GlassMenuItem>
        ));

        // THE FIX: The divider has been completely removed.
        return [providerHeader, ...modelItems];
      },
    );

    return [platformHeader, ...providerItems];
  });

  return (
    <FormControl
      variant="outlined"
      size="small"
      disabled={disabled}
      sx={{ width: '100%', minWidth: 0, height: compact ? 38 : undefined }}
    >
      {/* <InputLabel id="ai-model-select-label" sx={{ color: 'text.secondary' }}>
				{getLangText(LANG_KEYS.AI_MODEL)}
			</InputLabel> */}
      <GlassSelect
        labelId="ai-model-select-label"
        id="ai-model-select"
        value={modelName || ''}
        // label={getLangText(LANG_KEYS.AI_MODEL)}
        renderValue={(selected) => options.find((option) => option.id === selected)?.name ?? `${selected}`}
        onChange={(e) => handleModelChange(`${e.target.value}`)}
        disabled={disabled}
        sx={(theme) => ({
          minWidth: 0,
          height: compact ? 38 : undefined,
          ...(compact && {
            transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
              duration: 200,
            }),
            '&:hover, &.Mui-focused': {
              boxShadow: `0 0 8px 1px ${alpha(silver.main, theme.palette.mode === 'dark' ? 0.62 : 0.48)}`,
            },
          }),
          '& .MuiSelect-select': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: compact ? '0.9rem' : undefined,
          },
        })}
        MenuProps={{
          transitionDuration: disableMenuTransition ? 0 : undefined,
          PaperProps: {
            className: 'hide-scrollbar',
            sx: (theme) => {
              const styleObject = theme.palette.mode === 'dark' ? glassEffect : glassEffectLight;
              const { '&:hover': hoverStyles, ...baseStyles } = styleObject;

              return {
                ...baseStyles,
                ...hoverStyles,
                maxWidth: compact ? 'calc(100vw - 32px)' : undefined,
                maxHeight: compact ? 'min(55dvh, 420px)' : undefined,
                overflowX: 'hidden',
              };
            },
          },
        }}
      >
        {modelOptions}
      </GlassSelect>
    </FormControl>
  );
};

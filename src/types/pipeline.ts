export type ActionType = 'summarize' | 'translate' | 'tag_extract'

export interface ActionConfigMap {
  summarize: { maxLength: number }
  translate: { targetLanguage: string }
  tag_extract: { maxTags: number }
}

export type Action =
  | { type: 'summarize'; config: ActionConfigMap['summarize'] }
  | { type: 'translate'; config: ActionConfigMap['translate'] }
  | { type: 'tag_extract'; config: ActionConfigMap['tag_extract'] }

export interface Pipeline {
  id: string
  name: string
  source_token: string
  action_type: ActionType
  action_config: ActionConfigMap[ActionType]
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface Subscriber {
  id: string
  pipeline_id: string
  url: string
  created_at: Date
}

export interface PipelineWithSubscribers extends Pipeline {
  subscribers: Subscriber[]
}

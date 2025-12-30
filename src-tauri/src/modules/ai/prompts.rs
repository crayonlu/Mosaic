pub struct PromptBuilder;

impl PromptBuilder {
    // complete
    pub fn build_complete_prompt(content: &str, context: Option<&str>) -> String {
        let context_part = context
            .map(|context| format!("Context: {}", context))
            .unwrap_or_default();

        format!(
            "You are a helpful assistant.
            You are given a content and a context.
            You need to complete the content based on the context.
            keep the style and tone of the content.
            only output the continuation content and do not repeat the original text.
            use the language of the content.
            --- here is the content and context starting ---
            Content: {}
            Context: {}
            --- here is the continuation content ending ---
            ",
            content, context_part
        )
    }

    // polish
    pub fn build_rewrite_prompt(content: &str, style: Option<&str>) -> String {
        let style_instruction = style
            .map(|style| format!("Style: {}", style))
            .unwrap_or_default();

        format!(
            "You are a helpful assistant.
            You are given a content and a style.
            You need to rewrite the content based on the style.
            only output the rewritten content and do not repeat the original text.
            use the language of the content.
            --- here is the content and style starting ---
            Content: {}
            Style: {}
            --- here is the rewritten content ending ---
            ",
            content, style_instruction
        )
    }

    // summarize
    pub fn build_summarize_prompt(content: &str, max_length: Option<usize>) -> String {
        let max_length_instruction = max_length
            .map(|max_length| format!("Max Length: {}", max_length))
            .unwrap_or_default();

        format!(
            "You are a helpful assistant.
            You are given a content and a max length.
            You need to summarize the content based on the max length.
            only output the summarized content and do not repeat the original text.
            use the language of the content.
            use a space to separate between labels and do not repeat the same label.
            --- here is the content and max length starting ---
            Content: {}
            Max Length: {}
            --- here is the summarized content ending ---
            ",
            content, max_length_instruction
        )
    }

    // suggest tags
    pub fn build_suggest_tags_prompt(content: &str, existing_tags: Option<Vec<String>>) -> String {
        let existing_tags_instruction = existing_tags
            .map(|existing_tags| format!("Existing Tags: {}", existing_tags.join(", ")))
            .unwrap_or_default();

        format!(
            "You are a helpful assistant.
            You are given a content and existing tags.
            You need to suggest 3 to 5 tags for the content based on the existing tags.
            only output the suggested tags and do not repeat the existing tags.
            use the language of the content.
            use a space to devide every two tags.
            --- here is the content and existing tags starting ---
            Content: {}
            Existing Tags: {}
            --- here is the suggested tags ending ---
            ",
            content, existing_tags_instruction
        )
    }
}

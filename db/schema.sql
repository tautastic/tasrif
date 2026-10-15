CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE TYPE public.affix_mood AS ENUM (
    'perfect',
    'imperative',
    'imperfect_indicative',
    'imperfect_subjunctive',
    'imperfect_jussive'
);

CREATE TYPE public.alternative_noun_kind AS ENUM (
    'masdar',
    'active_participle',
    'passive_participle'
);

CREATE TYPE public.lang_type AS ENUM (
    'ar',
    'en'
);

CREATE TYPE public.person_type AS ENUM (
    'first_person_singular',
    'second_person_masculine_singular',
    'second_person_feminine_singular',
    'third_person_masculine_singular',
    'third_person_feminine_singular',
    'second_person_dual',
    'third_person_masculine_dual',
    'third_person_feminine_dual',
    'first_person_plural',
    'second_person_masculine_plural',
    'second_person_feminine_plural',
    'third_person_masculine_plural',
    'third_person_feminine_plural'
);

CREATE TYPE public.pos_type AS ENUM (
    'noun',
    'verb',
    'adjective',
    'adverb',
    'preposition',
    'conjunction',
    'interjection',
    'pronoun',
    'determiner',
    'particle',
    'adverbial_phrase',
    'idiom'
);

CREATE TYPE public.radical_kind AS ENUM (
    'sound',
    'waw',
    'ya',
    'hamza'
);

CREATE TYPE public.sense_relation_type AS ENUM (
    'synonym',
    'antonym',
    'hyponym',
    'hypernym',
    'near_synonym'
);

CREATE TYPE public.short_vowel AS ENUM (
    'a',
    'i',
    'u'
);

CREATE TYPE public.voice_type AS ENUM (
    'active',
    'passive'
);

CREATE TABLE public.affix_rules (
    id integer NOT NULL,
    mood public.affix_mood NOT NULL,
    person public.person_type NOT NULL,
    form integer DEFAULT 1 NOT NULL,
    prefix text DEFAULT ''::text NOT NULL,
    suffix text DEFAULT ''::text NOT NULL
);

CREATE SEQUENCE public.affix_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.affix_rules_id_seq OWNED BY public.affix_rules.id;

CREATE TABLE public.conjugation (
    id integer NOT NULL,
    lexical_entry_id integer NOT NULL,
    mood public.affix_mood NOT NULL,
    voice public.voice_type DEFAULT 'active'::public.voice_type NOT NULL,
    person public.person_type NOT NULL,
    form text NOT NULL
);

CREATE SEQUENCE public.conjugation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.conjugation_id_seq OWNED BY public.conjugation.id;

CREATE TABLE public.entry_slug_redirect (
    old_slug text NOT NULL,
    lexical_entry_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.lexical_entry (
    id integer NOT NULL,
    language public.lang_type NOT NULL,
    text character varying(255) NOT NULL,
    normalized_text text GENERATED ALWAYS AS (lower(regexp_replace((text)::text, '[[:punct:][:space:]ً-ٰٟؐ-ؚ]'::text, ''::text, 'g'::text))) STORED NOT NULL,
    root character varying(10),
    latin_root character varying(20),
    morph_pattern_id integer,
    morphology_overrides jsonb,
    masdar text,
    active_participle text,
    passive_participle text,
    search_vector tsvector,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    slug text
);

CREATE VIEW public.lexical_entry_derived_status AS
 SELECT id AS lexical_entry_id,
    (morph_pattern_id IS NOT NULL) AS has_pattern,
    ((masdar IS NOT NULL) OR (active_participle IS NOT NULL) OR (passive_participle IS NOT NULL)) AS has_verbal_nouns,
    (( SELECT count(*) AS count
           FROM public.conjugation c
          WHERE (c.lexical_entry_id = le.id)))::integer AS conjugation_count,
    ((morph_pattern_id IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
           FROM public.conjugation c
          WHERE (c.lexical_entry_id = le.id))))) AS needs_attention
   FROM public.lexical_entry le;

CREATE SEQUENCE public.lexical_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.lexical_entry_id_seq OWNED BY public.lexical_entry.id;

CREATE TABLE public.lexical_pattern_override (
    id integer NOT NULL,
    root character varying(10) NOT NULL,
    form_number smallint NOT NULL,
    perfect_vowel public.short_vowel,
    imperfect_vowel public.short_vowel,
    morph_pattern_id integer NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    variant text,
    CONSTRAINT chk_lexical_pattern_override_form1_vowels CHECK (((form_number = 1) = ((perfect_vowel IS NOT NULL) AND (imperfect_vowel IS NOT NULL)))),
    CONSTRAINT chk_lexical_pattern_override_variant CHECK (((variant IS NULL) OR ((char_length(variant) <= 40) AND (variant ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'::text))))
);

CREATE SEQUENCE public.lexical_pattern_override_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.lexical_pattern_override_id_seq OWNED BY public.lexical_pattern_override.id;

CREATE TABLE public.morph_pattern (
    id integer NOT NULL,
    form_number smallint NOT NULL,
    vocalic_template character varying(255) NOT NULL,
    description text NOT NULL,
    rules jsonb NOT NULL,
    no_affix boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    radical1_kind public.radical_kind DEFAULT 'sound'::public.radical_kind NOT NULL,
    radical2_kind public.radical_kind DEFAULT 'sound'::public.radical_kind NOT NULL,
    radical3_kind public.radical_kind DEFAULT 'sound'::public.radical_kind NOT NULL,
    is_geminate boolean DEFAULT false NOT NULL,
    perfect_vowel public.short_vowel,
    imperfect_vowel public.short_vowel,
    is_lexical boolean DEFAULT false NOT NULL,
    code text,
    radical_count smallint DEFAULT 3 NOT NULL,
    radical4_kind public.radical_kind DEFAULT 'sound'::public.radical_kind NOT NULL,
    CONSTRAINT chk_morph_pattern_code CHECK ((code ~ '^f[0-9]+(-[a-z]+)*$'::text)),
    CONSTRAINT chk_morph_pattern_quadriliteral_shape CHECK (((radical_count = 3) OR ((radical1_kind = 'sound'::public.radical_kind) AND (radical2_kind = 'sound'::public.radical_kind) AND (radical3_kind = 'sound'::public.radical_kind) AND (NOT is_geminate)))),
    CONSTRAINT chk_morph_pattern_radical4_kind CHECK (((radical4_kind = ANY (ARRAY['sound'::public.radical_kind, 'waw'::public.radical_kind, 'ya'::public.radical_kind])) AND ((radical_count = 4) OR (radical4_kind = 'sound'::public.radical_kind)))),
    CONSTRAINT chk_morph_pattern_radical_count CHECK ((radical_count = ANY (ARRAY[3, 4]))),
    CONSTRAINT chk_morph_pattern_radical_count_rules CHECK (((radical_count = 4) = (POSITION(('{4}'::text) IN ((rules)::text)) > 0)))
);

CREATE TABLE public.morph_pattern_alternative (
    id integer NOT NULL,
    morph_pattern_id integer NOT NULL,
    root character varying(10),
    voice public.voice_type DEFAULT 'active'::public.voice_type NOT NULL,
    mood public.affix_mood NOT NULL,
    person public.person_type NOT NULL,
    ordinal smallint DEFAULT 1 NOT NULL,
    template text NOT NULL,
    verbatim boolean DEFAULT false NOT NULL,
    note text,
    CONSTRAINT chk_morph_pattern_alternative_ordinal CHECK ((ordinal > 0)),
    CONSTRAINT chk_morph_pattern_alternative_template CHECK ((btrim(template) <> ''::text))
);

CREATE SEQUENCE public.morph_pattern_alternative_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.morph_pattern_alternative_id_seq OWNED BY public.morph_pattern_alternative.id;

CREATE TABLE public.morph_pattern_alternative_noun (
    id integer NOT NULL,
    morph_pattern_id integer NOT NULL,
    root character varying(10),
    noun public.alternative_noun_kind NOT NULL,
    ordinal smallint DEFAULT 1 NOT NULL,
    template text NOT NULL,
    verbatim boolean DEFAULT false NOT NULL,
    note text,
    CONSTRAINT chk_morph_pattern_alternative_noun_ordinal CHECK ((ordinal > 0)),
    CONSTRAINT chk_morph_pattern_alternative_noun_template CHECK ((btrim(template) <> ''::text))
);

CREATE SEQUENCE public.morph_pattern_alternative_noun_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.morph_pattern_alternative_noun_id_seq OWNED BY public.morph_pattern_alternative_noun.id;

CREATE SEQUENCE public.morph_pattern_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.morph_pattern_id_seq OWNED BY public.morph_pattern.id;

CREATE TABLE public.morph_pattern_resolution (
    id integer NOT NULL,
    morph_pattern_id integer NOT NULL,
    form_number smallint NOT NULL,
    perfect_vowel public.short_vowel,
    imperfect_vowel public.short_vowel,
    radical1_kind public.radical_kind NOT NULL,
    radical2_kind public.radical_kind NOT NULL,
    radical3_kind public.radical_kind NOT NULL,
    is_geminate boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    radical_count smallint DEFAULT 3 NOT NULL,
    radical4_kind public.radical_kind DEFAULT 'sound'::public.radical_kind NOT NULL,
    CONSTRAINT chk_morph_pattern_resolution_form1_vowels CHECK (((form_number = 1) = ((perfect_vowel IS NOT NULL) AND (imperfect_vowel IS NOT NULL))))
);

CREATE SEQUENCE public.morph_pattern_resolution_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.morph_pattern_resolution_id_seq OWNED BY public.morph_pattern_resolution.id;

CREATE TABLE public.sense (
    id integer NOT NULL,
    lexical_entry_id integer NOT NULL,
    pos public.pos_type NOT NULL,
    sense_number smallint NOT NULL,
    definitions text[] DEFAULT '{}'::text[] NOT NULL,
    context_tags text[] DEFAULT '{}'::text[] NOT NULL,
    examples text[] DEFAULT '{}'::text[] NOT NULL
);

CREATE SEQUENCE public.sense_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sense_id_seq OWNED BY public.sense.id;

CREATE TABLE public.sense_relation (
    id integer NOT NULL,
    sense_id_1 integer NOT NULL,
    sense_id_2 integer NOT NULL,
    relation_type public.sense_relation_type NOT NULL,
    strength smallint DEFAULT 5,
    context_note text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sense_different CHECK ((sense_id_1 <> sense_id_2))
);

CREATE SEQUENCE public.sense_relation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sense_relation_id_seq OWNED BY public.sense_relation.id;

CREATE VIEW public.sense_relation_normalized AS
 SELECT sense_id,
    target_sense_id,
    target_text,
    target_normalized_text,
    relation_type,
    context_note,
    strength,
    target_slug
   FROM ( SELECT DISTINCT ON (combined.sense_id, combined.target_sense_id, combined.relation_type) combined.sense_id,
            combined.target_sense_id,
            combined.target_text,
            combined.target_normalized_text,
            combined.relation_type,
            combined.context_note,
            combined.strength,
            combined.target_slug
           FROM ( SELECT sr.sense_id_1 AS sense_id,
                    sr.sense_id_2 AS target_sense_id,
                    le.text AS target_text,
                    le.normalized_text AS target_normalized_text,
                    sr.relation_type,
                    sr.context_note,
                    sr.strength,
                    le.slug AS target_slug
                   FROM ((public.sense_relation sr
                     JOIN public.sense s ON ((sr.sense_id_2 = s.id)))
                     JOIN public.lexical_entry le ON ((s.lexical_entry_id = le.id)))
                UNION ALL
                 SELECT sr.sense_id_2 AS sense_id,
                    sr.sense_id_1 AS target_sense_id,
                    le.text AS target_text,
                    le.normalized_text AS target_normalized_text,
                        CASE sr.relation_type
                            WHEN 'hyponym'::public.sense_relation_type THEN 'hypernym'::public.sense_relation_type
                            WHEN 'hypernym'::public.sense_relation_type THEN 'hyponym'::public.sense_relation_type
                            ELSE sr.relation_type
                        END AS relation_type,
                    sr.context_note,
                    sr.strength,
                    le.slug AS target_slug
                   FROM ((public.sense_relation sr
                     JOIN public.sense s ON ((sr.sense_id_1 = s.id)))
                     JOIN public.lexical_entry le ON ((s.lexical_entry_id = le.id)))) combined
          ORDER BY combined.sense_id, combined.target_sense_id, combined.relation_type, combined.strength DESC NULLS LAST) deduped
  ORDER BY sense_id, target_normalized_text, relation_type, target_sense_id;

CREATE TABLE public.translation_link (
    id integer NOT NULL,
    en_sense_id integer NOT NULL,
    ar_sense_id integer NOT NULL,
    frequency_rank smallint DEFAULT 5,
    domain character varying(50),
    note text
);

CREATE VIEW public.sense_translation_normalized AS
 SELECT sense_id,
    target_sense_id,
    target_text,
    target_normalized_text,
    domain,
    note,
    frequency_rank,
    target_slug
   FROM ( SELECT DISTINCT ON (combined.sense_id, combined.target_sense_id) combined.sense_id,
            combined.target_sense_id,
            combined.target_text,
            combined.target_normalized_text,
            combined.domain,
            combined.note,
            combined.frequency_rank,
            combined.target_slug
           FROM ( SELECT tl.en_sense_id AS sense_id,
                    tl.ar_sense_id AS target_sense_id,
                    ar_le.text AS target_text,
                    ar_le.normalized_text AS target_normalized_text,
                    tl.domain,
                    tl.note,
                    tl.frequency_rank,
                    ar_le.slug AS target_slug
                   FROM ((public.translation_link tl
                     JOIN public.sense ar_s ON ((tl.ar_sense_id = ar_s.id)))
                     JOIN public.lexical_entry ar_le ON ((ar_s.lexical_entry_id = ar_le.id)))
                UNION ALL
                 SELECT tl.ar_sense_id AS sense_id,
                    tl.en_sense_id AS target_sense_id,
                    en_le.text AS target_text,
                    en_le.normalized_text AS target_normalized_text,
                    tl.domain,
                    tl.note,
                    tl.frequency_rank,
                    en_le.slug AS target_slug
                   FROM ((public.translation_link tl
                     JOIN public.sense en_s ON ((tl.en_sense_id = en_s.id)))
                     JOIN public.lexical_entry en_le ON ((en_s.lexical_entry_id = en_le.id)))) combined
          ORDER BY combined.sense_id, combined.target_sense_id, combined.frequency_rank) deduped
  ORDER BY sense_id, target_normalized_text, frequency_rank, target_sense_id;

CREATE SEQUENCE public.translation_link_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.translation_link_id_seq OWNED BY public.translation_link.id;

ALTER TABLE ONLY public.affix_rules ALTER COLUMN id SET DEFAULT nextval('public.affix_rules_id_seq'::regclass);

ALTER TABLE ONLY public.conjugation ALTER COLUMN id SET DEFAULT nextval('public.conjugation_id_seq'::regclass);

ALTER TABLE ONLY public.lexical_entry ALTER COLUMN id SET DEFAULT nextval('public.lexical_entry_id_seq'::regclass);

ALTER TABLE ONLY public.lexical_pattern_override ALTER COLUMN id SET DEFAULT nextval('public.lexical_pattern_override_id_seq'::regclass);

ALTER TABLE ONLY public.morph_pattern ALTER COLUMN id SET DEFAULT nextval('public.morph_pattern_id_seq'::regclass);

ALTER TABLE ONLY public.morph_pattern_alternative ALTER COLUMN id SET DEFAULT nextval('public.morph_pattern_alternative_id_seq'::regclass);

ALTER TABLE ONLY public.morph_pattern_alternative_noun ALTER COLUMN id SET DEFAULT nextval('public.morph_pattern_alternative_noun_id_seq'::regclass);

ALTER TABLE ONLY public.morph_pattern_resolution ALTER COLUMN id SET DEFAULT nextval('public.morph_pattern_resolution_id_seq'::regclass);

ALTER TABLE ONLY public.sense ALTER COLUMN id SET DEFAULT nextval('public.sense_id_seq'::regclass);

ALTER TABLE ONLY public.sense_relation ALTER COLUMN id SET DEFAULT nextval('public.sense_relation_id_seq'::regclass);

ALTER TABLE ONLY public.translation_link ALTER COLUMN id SET DEFAULT nextval('public.translation_link_id_seq'::regclass);

ALTER TABLE ONLY public.affix_rules
    ADD CONSTRAINT affix_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conjugation
    ADD CONSTRAINT conjugation_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.entry_slug_redirect
    ADD CONSTRAINT entry_slug_redirect_pkey PRIMARY KEY (old_slug);

ALTER TABLE ONLY public.lexical_entry
    ADD CONSTRAINT lexical_entry_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lexical_pattern_override
    ADD CONSTRAINT lexical_pattern_override_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.morph_pattern_alternative_noun
    ADD CONSTRAINT morph_pattern_alternative_noun_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.morph_pattern_alternative
    ADD CONSTRAINT morph_pattern_alternative_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.morph_pattern
    ADD CONSTRAINT morph_pattern_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.morph_pattern_resolution
    ADD CONSTRAINT morph_pattern_resolution_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sense
    ADD CONSTRAINT sense_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sense_relation
    ADD CONSTRAINT sense_relation_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.translation_link
    ADD CONSTRAINT translation_link_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.affix_rules
    ADD CONSTRAINT unique_affix_rule UNIQUE (mood, person, form);

ALTER TABLE ONLY public.conjugation
    ADD CONSTRAINT unique_conjugation_entry_voice_mood_person UNIQUE (lexical_entry_id, voice, mood, person);

ALTER TABLE ONLY public.morph_pattern
    ADD CONSTRAINT unique_form_number_description UNIQUE (form_number, radical_count, description);

ALTER TABLE ONLY public.lexical_entry
    ADD CONSTRAINT unique_language_text UNIQUE (language, text);

ALTER TABLE ONLY public.lexical_pattern_override
    ADD CONSTRAINT unique_lexical_pattern_override_key UNIQUE NULLS NOT DISTINCT (root, form_number, perfect_vowel, imperfect_vowel, variant);

ALTER TABLE ONLY public.morph_pattern_alternative
    ADD CONSTRAINT unique_morph_pattern_alternative_key UNIQUE NULLS NOT DISTINCT (morph_pattern_id, root, voice, mood, person, ordinal);

ALTER TABLE ONLY public.morph_pattern_alternative_noun
    ADD CONSTRAINT unique_morph_pattern_alternative_noun_key UNIQUE NULLS NOT DISTINCT (morph_pattern_id, root, noun, ordinal);

ALTER TABLE ONLY public.morph_pattern
    ADD CONSTRAINT unique_morph_pattern_code UNIQUE (code);

ALTER TABLE ONLY public.morph_pattern_resolution
    ADD CONSTRAINT unique_morph_pattern_resolution_key UNIQUE NULLS NOT DISTINCT (form_number, radical_count, perfect_vowel, imperfect_vowel, radical1_kind, radical2_kind, radical3_kind, radical4_kind, is_geminate);

ALTER TABLE ONLY public.sense_relation
    ADD CONSTRAINT unique_relation UNIQUE (sense_id_1, sense_id_2, relation_type);

ALTER TABLE ONLY public.sense
    ADD CONSTRAINT unique_sense_number UNIQUE (lexical_entry_id, sense_number);

ALTER TABLE ONLY public.translation_link
    ADD CONSTRAINT unique_translation UNIQUE (en_sense_id, ar_sense_id);

CREATE INDEX idx_conjugation_mood ON public.conjugation USING btree (mood);

CREATE INDEX idx_description ON public.morph_pattern USING btree (description);

CREATE INDEX idx_entry_slug_redirect_entry ON public.entry_slug_redirect USING btree (lexical_entry_id);

CREATE INDEX idx_lexical_entry_language_created_at ON public.lexical_entry USING btree (language, created_at DESC);

CREATE INDEX idx_lexical_entry_latin_root ON public.lexical_entry USING btree (latin_root);

CREATE INDEX idx_lexical_entry_normalized_text ON public.lexical_entry USING btree (normalized_text);

CREATE INDEX idx_lexical_entry_normalized_text_prefix ON public.lexical_entry USING btree (normalized_text text_pattern_ops);

CREATE INDEX idx_lexical_entry_normalized_text_trgm ON public.lexical_entry USING gin (normalized_text public.gin_trgm_ops);

CREATE INDEX idx_lexical_entry_pattern ON public.lexical_entry USING btree (morph_pattern_id);

CREATE INDEX idx_lexical_entry_root ON public.lexical_entry USING btree (root);

CREATE INDEX idx_lexical_entry_search_vector ON public.lexical_entry USING gin (search_vector);

CREATE INDEX idx_lexical_entry_slug ON public.lexical_entry USING btree (slug);

CREATE INDEX idx_lexical_entry_text_trgm ON public.lexical_entry USING gin (text public.gin_trgm_ops);

CREATE INDEX idx_lexical_pattern_override_pattern ON public.lexical_pattern_override USING btree (morph_pattern_id);

CREATE INDEX idx_morph_pattern_alternative_noun_pattern ON public.morph_pattern_alternative_noun USING btree (morph_pattern_id);

CREATE INDEX idx_morph_pattern_alternative_pattern ON public.morph_pattern_alternative USING btree (morph_pattern_id);

CREATE INDEX idx_morph_pattern_resolution_pattern ON public.morph_pattern_resolution USING btree (morph_pattern_id);

CREATE INDEX idx_sense_context_tags ON public.sense USING gin (context_tags);

CREATE INDEX idx_sense_definitions ON public.sense USING gin (definitions);

CREATE INDEX idx_sense_relation_sense_id_2 ON public.sense_relation USING btree (sense_id_2);

CREATE INDEX idx_translation_link_ar_sense_id ON public.translation_link USING btree (ar_sense_id);

ALTER TABLE ONLY public.conjugation
    ADD CONSTRAINT conjugation_lexical_entry_id_lexical_entry_id_fkey FOREIGN KEY (lexical_entry_id) REFERENCES public.lexical_entry(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.entry_slug_redirect
    ADD CONSTRAINT entry_slug_redirect_lexical_entry_id_lexical_entry_id_fkey FOREIGN KEY (lexical_entry_id) REFERENCES public.lexical_entry(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.morph_pattern_alternative_noun
    ADD CONSTRAINT fk_morph_pattern_alternative_noun_pattern FOREIGN KEY (morph_pattern_id) REFERENCES public.morph_pattern(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.morph_pattern_alternative
    ADD CONSTRAINT fk_morph_pattern_alternative_pattern FOREIGN KEY (morph_pattern_id) REFERENCES public.morph_pattern(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lexical_entry
    ADD CONSTRAINT lexical_entry_morph_pattern_id_morph_pattern_id_fkey FOREIGN KEY (morph_pattern_id) REFERENCES public.morph_pattern(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.lexical_pattern_override
    ADD CONSTRAINT lexical_pattern_override_morph_pattern_id_morph_pattern_id_fkey FOREIGN KEY (morph_pattern_id) REFERENCES public.morph_pattern(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.morph_pattern_resolution
    ADD CONSTRAINT morph_pattern_resolution_morph_pattern_id_morph_pattern_id_fkey FOREIGN KEY (morph_pattern_id) REFERENCES public.morph_pattern(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sense
    ADD CONSTRAINT sense_lexical_entry_id_lexical_entry_id_fkey FOREIGN KEY (lexical_entry_id) REFERENCES public.lexical_entry(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sense_relation
    ADD CONSTRAINT sense_relation_sense_id_1_sense_id_fkey FOREIGN KEY (sense_id_1) REFERENCES public.sense(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sense_relation
    ADD CONSTRAINT sense_relation_sense_id_2_sense_id_fkey FOREIGN KEY (sense_id_2) REFERENCES public.sense(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.translation_link
    ADD CONSTRAINT translation_link_ar_sense_id_sense_id_fkey FOREIGN KEY (ar_sense_id) REFERENCES public.sense(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.translation_link
    ADD CONSTRAINT translation_link_en_sense_id_sense_id_fkey FOREIGN KEY (en_sense_id) REFERENCES public.sense(id) ON DELETE CASCADE;


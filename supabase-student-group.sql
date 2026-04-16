-- Run this in Supabase SQL Editor.
-- Adds a free-text student group field, separate from the existing month field.

alter table public.students
add column if not exists student_group text;

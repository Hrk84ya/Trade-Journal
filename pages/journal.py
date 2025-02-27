import streamlit as st
from datetime import datetime

st.title("📝 Trading Journal")

# Journal Entry Form
st.subheader("New Journal Entry")
with st.form("journal_entry_form", clear_on_submit=True):
    title = st.text_input("Entry Title")
    content = st.text_area("What's on your mind?")
    mood = st.select_slider(
        "Trading Mood",
        options=["Very Negative", "Negative", "Neutral", "Positive", "Very Positive"]
    )
    lessons_learned = st.text_area("Lessons Learned")
    
    submitted = st.form_submit_button("Save Entry")
    
    if submitted:
        if not title or not content:
            st.error("Please fill in all required fields")
        else:
            journal_data = {
                'title': title,
                'content': content,
                'mood': mood,
                'lessons_learned': lessons_learned
            }
            st.session_state.data_manager.save_journal_entry(journal_data)
            st.success("Journal entry saved successfully!")

# Journal Entries Display
st.subheader("Previous Entries")
journal_entries = st.session_state.data_manager.get_journal_entries()

if not journal_entries.empty:
    for idx, entry in journal_entries.sort_values('date', ascending=False).iterrows():
        with st.expander(f"{entry['date']} - {entry['title']}"):
            st.markdown(f"**Mood:** {entry['mood']}")
            st.markdown("**Entry:**")
            st.markdown(entry['content'])
            if entry['lessons_learned']:
                st.markdown("**Lessons Learned:**")
                st.markdown(entry['lessons_learned'])
else:
    st.info("No journal entries yet")

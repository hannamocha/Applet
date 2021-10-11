import React, { useState, useEffect } from 'react';
import './App.css';
import { API, Storage } from 'aws-amplify';
import { withAuthenticator, AmplifySignOut } from '@aws-amplify/ui-react';
import { listNotes } from './graphql/queries';
import { createNote as createNoteMutation, updateNote as updateNoteMutation, deleteNote as deleteNoteMutation } from './graphql/mutations';

const initialFormState = { name: '', description: '' }

function App() {
  const [notes, setNotes] = useState([]);
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    const apiData = await API.graphql({ query: listNotes });
    const notesFromAPI = apiData.data.listNotes.items;
    await Promise.all(notesFromAPI.map(async note => {
      if (note.image) {
        note.imageName = note.image;
        const image = await Storage.get(note.image);
        note.image = image;
      }
      note.isEditing = false;
      return note;
    }))

    setNotes(apiData.data.listNotes.items);
  }

  async function createNote() {
    if (!formData.name || !formData.description) return;
    await API.graphql({ query: createNoteMutation, variables: { input: formData } });
    if (formData.image) {
      const image = await Storage.get(formData.image);
      formData.image = image;
    }
    fetchNotes();
    setFormData(initialFormState);
  }

  async function deleteNote({ id }) {
    const newNotesArray = notes.filter(note => note.id !== id);
    setNotes(newNotesArray);
    await API.graphql({ query: deleteNoteMutation, variables: { input: { id } }});
  }

  async function onChange(e) {
    if (!e.target.files[0]) return
    const file = e.target.files[0];
    setFormData({ ...formData, image: file.name });
    await Storage.put(file.name, file);
    fetchNotes();
  }

  async function updateNote(note) {
    if (!note.name || !note.description) return;

    const apiData = await API.graphql({ query: listNotes });
    const oldNotes = apiData.data.listNotes.items;
    const oldObjIndex =  oldNotes.findIndex((obj => obj.id === note.id));

    if (note.name === oldNotes[oldObjIndex].name) {
      fetchNotes();
      return;
    }

    // Prepare the list to be saved by GraphQL
    notes.map(async e => {
      delete e.isEditing;
      if (e.image) {
        e.image = e.imageName;
        delete e.imageName;
      }
      return e;
    });

    await API.graphql({ query: updateNoteMutation, variables: { input: note } });
    fetchNotes();

  }

  function isEditingNote(note) {
    const objIndex = notes.findIndex((obj => obj.id === note.id));
    if (notes[objIndex]) {
      notes[objIndex].isEditing = true;
    }
    setFormData({ ...formData});
  }

  function EditNote(props) {
    if (props) {
      const note = notes.find(note => note.id === props.id);
      const newNotesArray = notes.filter(e => e.id !== note.id);
      if (note && note.isEditing) {
        return ([<input key={note.id+"input"}
                  name="name"
                  onChange={e => setNotes([ ...newNotesArray, {'name': e.target.value, 
                                                              'description': note.description,
                                                              'id': note.id,
                                                              'isEditing': note.isEditing,
                                                              'imageName': note.imageName,
                                                              'image': note.image}])}
                  placeholder="Note name"
                  value={note.name}
                />,
                <p key={note.id+"editDesc"}>{note.description}</p>,
                <button key={note.id+"aupdateButton"} onClick={() => updateNote(note)}>Save</button>]);
      } else {
        return ([<h2 key={note.id+"name"}>{note.name}</h2>,
          <p key={note.id+"desc"}>{note.description}</p>,
          <button key={note.id+"editButton"} onClick={() => isEditingNote(note)}>Edit Name</button>]);
      }
   }
   return;
  }

  return (
    <div className="App">
      <h1>Notes Applet</h1>
      <input
        onChange={e => setFormData({ ...formData, 'name': e.target.value})}
        placeholder="Note name"
        value={formData.name}
      />
      <input
        onChange={e => setFormData({ ...formData, 'description': e.target.value})}
        placeholder="Note description"
        value={formData.description}
      />
      <input
       type="file"
       onChange={onChange}
      />
      <button onClick={createNote}>Create Note</button>
      <br></br>
      <div style={{marginBottom: 30}}>
        {
          notes.sort((a, b) => a.id < b.id ? -1 : (a.id > b.id ? 1 : 0)).map(note => (
            <div key={note.id+"parentdiv"}>
              <br key={note.id+"br"}></br>
              <EditNote id={note.id}/>
              <button key={note.id+"delete"} onClick={() => deleteNote(note)}>Delete note</button>
              <div key={note.id+"imagediv"}>
                {
                  note.image && <img key={note.id+"img"} src={note.image} style={{width: 400}} />
                }
              </div>
            </div>
          ))
        }
      </div>
      <AmplifySignOut />
    </div>
  );
}

export default withAuthenticator(App);
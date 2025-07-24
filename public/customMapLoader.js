function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file.');
        return;
    }

    const allowedTypes = ['text/csv', 'application/vnd.ms-excel']; // CSV types
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension !== 'csv' && !allowedTypes.includes(file.type)) {
        alert('Please upload a valid CSV file.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(data => alert(data))
    .catch(err => {
        console.error(err);
        alert("Upload failed");
    });
}

const switchMapsButton = document.getElementById('switch-maps-button');
let isRequestInProgress = false;
let currentlyActivate = true; 


function activateRandomMap() {
    console.log(currentlyActivate);

    if (isRequestInProgress) return;

    isRequestInProgress = true;
    const url = currentlyActivate
        ? 'http://localhost:8000/activateRandomMap'
        : 'http://localhost:8000/deactivateRandomMap';


    switchMapsButton.innerText = currentlyActivate? 'Switch to random map' : 'Switch to custom map';


    fetch(url, {
        method: 'POST'
    })
    .then(response => response.text())
    .then(data => {
        console.log("after chaneg: " + currentlyActivate);
        currentlyActivate = !currentlyActivate; // Flip state only on success
    })
    .catch(err => {
        console.error(err);
    })
    .finally(() => {
        isRequestInProgress = false;
    });
}

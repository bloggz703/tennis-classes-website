// Initialize map and places service
let map;
let placesService;
let geocoder;
let currentInfoWindow = null;
let markers = [];
let favorites = {};

// Initialize map
function initMap() {
    // Default center (US)
    const defaultCenter = { lat: 39.8283, lng: -98.5795 };
    
    // Initialize the map
    map = new google.maps.Map(document.getElementById('map'), {
        center: defaultCenter,
        zoom: 4,
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });
    
    // Initialize Places service
    placesService = new google.maps.places.PlacesService(map);
    
    // Initialize Geocoder
    geocoder = new google.maps.Geocoder();
}

// Search by ZIP code
async function searchByZipCode() {
    const zipCode = document.getElementById('zipCode').value.trim();
    if (!zipCode) {
        showToast('Please enter a ZIP code', 'error');
        return;
    }
    
    try {
        const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${zipCode}&key=ef0dd3a6ee33499aa40d503b8b73554d&countrycode=us`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const location = data.results[0].geometry;
            searchNearbyTennisClasses(location);
        } else {
            showToast('Invalid ZIP code. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error geocoding ZIP code:', error);
        showToast('Error finding location. Please try again.', 'error');
    }
}

// Use current location
function useCurrentLocation() {
    const locationButton = document.querySelector('button[onclick="useCurrentLocation()"]');
    const originalText = locationButton.innerHTML;
    
    // Show loading state
    locationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Location...';
    locationButton.disabled = true;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                searchNearbyTennisClasses(location);
                
                // Reset button
                locationButton.innerHTML = originalText;
                locationButton.disabled = false;
            },
            error => {
                console.error('Error getting location:', error);
                let errorMessage = 'Error getting your location. Please try entering a ZIP code.';
                
                // More specific error messages
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access was denied. Please enable location services in your browser settings or enter a ZIP code.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable. Please try entering a ZIP code.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out. Please try again or enter a ZIP code.';
                        break;
                }
                
                showToast(errorMessage, 'error');
                
                // Reset button
                locationButton.innerHTML = originalText;
                locationButton.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        showToast('Geolocation is not supported by your browser. Please enter a ZIP code.', 'error');
        // Reset button
        locationButton.innerHTML = originalText;
        locationButton.disabled = false;
    }
}

// Search for nearby tennis classes
function searchNearbyTennisClasses(location) {
    if (!map || !placesService) {
        showToast('Map service not initialized. Please refresh the page.', 'error');
        return;
    }

    clearMarkers();
    
    const radius = document.getElementById('radius')?.value || 10;
    
    const request = {
        location: location,
        radius: radius * 1609.34, // Convert miles to meters
        keyword: 'tennis lessons classes courts',
        type: ['gym', 'park', 'sports_complex']
    };
    
    try {
        placesService.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                // Filter results
                const filteredResults = filterResults(results);
                
                if (filteredResults.length === 0) {
                    showToast('No tennis classes found in this area. Try expanding your search radius.', 'info');
                    // Center map on search location with appropriate zoom
                    map.setCenter(location);
                    map.setZoom(11);
                    return;
                }
                
                // Display results
                displayResults(filteredResults, location);
                
                // Create markers and fit bounds
                const bounds = new google.maps.LatLngBounds();
                bounds.extend(location); // Include search location
                
                filteredResults.forEach(place => {
                    const marker = createMarker(place);
                    bounds.extend(marker.getPosition());
                });
                
                // Fit map to show all markers
                map.fitBounds(bounds);
                
                // Don't zoom in too close if only one result
                const zoom = map.getZoom();
                if (zoom > 15) map.setZoom(15);
                
            } else {
                console.error('Places search failed:', status);
                showToast('Error finding tennis classes. Please try again.', 'error');
                
                // Center map on search location
                map.setCenter(location);
                map.setZoom(11);
            }
        });
    } catch (error) {
        console.error('Error in searchNearbyTennisClasses:', error);
        showToast('An error occurred while searching. Please try again.', 'error');
    }
}

// Filter results based on user preferences
function filterResults(results) {
    return results.filter(place => {
        // Add your filtering logic here
        return true; // For now, return all results
    });
}

// Display search results with distance
function displayResults(results, userLocation) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = ''; // Clear previous results
    
    results.forEach(place => {
        const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
        
        const resultHtml = `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 shadow-sm">
                    <div class="card-body">
                        <h5 class="card-title">${place.name}</h5>
                        <p class="card-text text-muted">
                            <i class="fas fa-map-marker-alt"></i> ${place.vicinity}<br>
                            <i class="fas fa-road"></i> ${distance.toFixed(1)} miles away
                        </p>
                        <div class="d-flex justify-content-between align-items-center">
                            <button class="btn btn-primary btn-sm" onclick="getPlaceDetails('${place.place_id}')">
                                View Details
                            </button>
                            <button class="btn btn-outline-secondary btn-sm" onclick="toggleFavorite('${place.place_id}')">
                                <i class="fas fa-heart${favorites[place.place_id] ? ' text-danger' : ''}"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML += resultHtml;
    });
}

// Calculate distance between two points in miles
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Create a marker for a place
function createMarker(place) {
    const marker = new google.maps.Marker({
        map: map,
        position: place.geometry.location,
        title: place.name
    });
    
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div class="info-window">
                <h5>${place.name}</h5>
                <p>${place.vicinity}</p>
                <button class="btn btn-primary btn-sm" onclick="getPlaceDetails('${place.place_id}')">
                    View Details
                </button>
            </div>
        `
    });
    
    marker.addListener('click', () => {
        if (currentInfoWindow) {
            currentInfoWindow.close();
        }
        currentInfoWindow = infoWindow;
        infoWindow.open(map, marker);
    });
    
    markers.push(marker);
    return marker;
}

// Clear existing markers
function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

// Get detailed information about a place
function getPlaceDetails(placeId) {
    const request = {
        placeId: placeId,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'rating', 'opening_hours', 'website', 'photos']
    };
    
    placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            showPlaceDetails(place);
        } else {
            showToast('Error getting place details. Please try again.', 'error');
        }
    });
}

// Show place details in a modal
function showPlaceDetails(place) {
    const modalHtml = `
        <div class="modal fade" id="placeDetailsModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${place.name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p><i class="fas fa-map-marker-alt"></i> ${place.formatted_address || 'Address not available'}</p>
                        ${place.formatted_phone_number ? `<p><i class="fas fa-phone"></i> ${place.formatted_phone_number}</p>` : ''}
                        ${place.rating ? `
                            <p>
                                <i class="fas fa-star text-warning"></i>
                                ${place.rating} / 5
                            </p>
                        ` : ''}
                        ${place.opening_hours ? `
                            <div class="mb-3">
                                <h6>Hours:</h6>
                                <ul class="list-unstyled">
                                    ${place.opening_hours.weekday_text.map(day => `<li>${day}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${place.website ? `
                            <p>
                                <a href="${place.website}" target="_blank" rel="noopener noreferrer">
                                    <i class="fas fa-globe"></i> Visit Website
                                </a>
                            </p>
                        ` : ''}
                        ${place.photos && place.photos.length > 0 ? `
                            <div class="place-photos">
                                <img src="${place.photos[0].getUrl()}" alt="${place.name}" class="img-fluid rounded">
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('placeDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add new modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('placeDetailsModal'));
    modal.show();
}

// Toggle favorite status
function toggleFavorite(placeId) {
    favorites[placeId] = !favorites[placeId];
    
    // Update heart icon
    const heartIcon = document.querySelector(`button[onclick="toggleFavorite('${placeId}')"] i`);
    if (heartIcon) {
        heartIcon.classList.toggle('text-danger');
    }
    
    // Save to localStorage
    localStorage.setItem('tennisClassFavorites', JSON.stringify(favorites));
    
    showToast(
        favorites[placeId] ? 'Added to favorites!' : 'Removed from favorites',
        favorites[placeId] ? 'success' : 'info'
    );
}

// Show toast messages
function showToast(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const toastBody = toast.querySelector('.toast-body');
    
    // Set message and style
    toastBody.textContent = message;
    toast.className = `toast ${type === 'error' ? 'bg-danger text-white' : 'bg-light'}`;
    
    // Show toast using Bootstrap
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Load favorites from localStorage
try {
    const savedFavorites = localStorage.getItem('tennisClassFavorites');
    if (savedFavorites) {
        favorites = JSON.parse(savedFavorites);
    }
} catch (error) {
    console.error('Error loading favorites:', error);
}

// Initialize Google Map
function initMap() {
    // Default center (US)
    const defaultCenter = { lat: 39.8283, lng: -98.5795 };
    
    // Initialize the map
    map = new google.maps.Map(document.getElementById('map'), {
        center: defaultCenter,
        zoom: 4,
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });
    
    // Initialize Places service
    placesService = new google.maps.places.PlacesService(map);
    
    // Initialize Geocoder
    geocoder = new google.maps.Geocoder();
}

// Search by ZIP code
async function searchByZipCode() {
    const zipCode = document.getElementById('zipCode').value.trim();
    if (!zipCode) {
        showToast('Please enter a ZIP code', 'error');
        return;
    }
    
    try {
        const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${zipCode}&key=ef0dd3a6ee33499aa40d503b8b73554d&countrycode=us`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const location = data.results[0].geometry;
            searchNearbyTennisClasses(location);
        } else {
            showToast('Invalid ZIP code. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error geocoding ZIP code:', error);
        showToast('Error finding location. Please try again.', 'error');
    }
}

// Use current location
function useCurrentLocation() {
    const locationButton = document.querySelector('button[onclick="useCurrentLocation()"]');
    const originalText = locationButton.innerHTML;
    
    // Show loading state
    locationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting Location...';
    locationButton.disabled = true;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                searchNearbyTennisClasses(location);
                
                // Reset button
                locationButton.innerHTML = originalText;
                locationButton.disabled = false;
            },
            error => {
                console.error('Error getting location:', error);
                let errorMessage = 'Error getting your location. Please try entering a ZIP code.';
                
                // More specific error messages
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access was denied. Please enable location services in your browser settings or enter a ZIP code.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable. Please try entering a ZIP code.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out. Please try again or enter a ZIP code.';
                        break;
                }
                
                showToast(errorMessage, 'error');
                
                // Reset button
                locationButton.innerHTML = originalText;
                locationButton.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        showToast('Geolocation is not supported by your browser. Please enter a ZIP code.', 'error');
        // Reset button
        locationButton.innerHTML = originalText;
        locationButton.disabled = false;
    }
}

// Search for nearby tennis classes
function searchNearbyTennisClasses(location) {
    if (!map || !placesService) {
        showToast('Map service not initialized. Please refresh the page.', 'error');
        return;
    }

    clearMarkers();
    
    const radius = document.getElementById('radius')?.value || 10;
    
    const request = {
        location: location,
        radius: radius * 1609.34, // Convert miles to meters
        keyword: 'tennis lessons classes courts',
        type: ['gym', 'park', 'sports_complex']
    };
    
    try {
        placesService.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                // Filter results
                const filteredResults = filterResults(results);
                
                if (filteredResults.length === 0) {
                    showToast('No tennis classes found in this area. Try expanding your search radius.', 'info');
                    // Center map on search location with appropriate zoom
                    map.setCenter(location);
                    map.setZoom(11);
                    return;
                }
                
                // Display results
                displayResults(filteredResults, location);
                
                // Create markers and fit bounds
                const bounds = new google.maps.LatLngBounds();
                bounds.extend(location); // Include search location
                
                filteredResults.forEach(place => {
                    const marker = createMarker(place);
                    bounds.extend(marker.getPosition());
                });
                
                // Fit map to show all markers
                map.fitBounds(bounds);
                
                // Don't zoom in too close if only one result
                const zoom = map.getZoom();
                if (zoom > 15) map.setZoom(15);
                
            } else {
                console.error('Places search failed:', status);
                showToast('Error finding tennis classes. Please try again.', 'error');
                
                // Center map on search location
                map.setCenter(location);
                map.setZoom(11);
            }
        });
    } catch (error) {
        console.error('Error in searchNearbyTennisClasses:', error);
        showToast('An error occurred while searching. Please try again.', 'error');
    }
}

// Filter results based on user preferences
function filterResults(results) {
    return results.filter(place => {
        // Add your filtering logic here
        return true; // For now, return all results
    });
}

// Display search results with distance
function displayResults(results, userLocation) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = ''; // Clear previous results
    
    results.forEach(place => {
        const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
        
        const resultHtml = `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 shadow-sm">
                    <div class="card-body">
                        <h5 class="card-title">${place.name}</h5>
                        <p class="card-text text-muted">
                            <i class="fas fa-map-marker-alt"></i> ${place.vicinity}<br>
                            <i class="fas fa-road"></i> ${distance.toFixed(1)} miles away
                        </p>
                        <div class="d-flex justify-content-between align-items-center">
                            <button class="btn btn-primary btn-sm" onclick="getPlaceDetails('${place.place_id}')">
                                View Details
                            </button>
                            <button class="btn btn-outline-secondary btn-sm" onclick="toggleFavorite('${place.place_id}')">
                                <i class="fas fa-heart${favorites[place.place_id] ? ' text-danger' : ''}"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML += resultHtml;
    });
}

// Calculate distance between two points in miles
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Create a marker for a place
function createMarker(place) {
    const marker = new google.maps.Marker({
        map: map,
        position: place.geometry.location,
        title: place.name
    });
    
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div class="info-window">
                <h5>${place.name}</h5>
                <p>${place.vicinity}</p>
                <button class="btn btn-primary btn-sm" onclick="getPlaceDetails('${place.place_id}')">
                    View Details
                </button>
            </div>
        `
    });
    
    marker.addListener('click', () => {
        if (currentInfoWindow) {
            currentInfoWindow.close();
        }
        currentInfoWindow = infoWindow;
        infoWindow.open(map, marker);
    });
    
    markers.push(marker);
    return marker;
}

// Clear existing markers
function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

// Get detailed information about a place
function getPlaceDetails(placeId) {
    const request = {
        placeId: placeId,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'rating', 'opening_hours', 'website', 'photos']
    };
    
    placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            showPlaceDetails(place);
        } else {
            showToast('Error getting place details. Please try again.', 'error');
        }
    });
}

// Show place details in a modal
function showPlaceDetails(place) {
    const modalHtml = `
        <div class="modal fade" id="placeDetailsModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${place.name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p><i class="fas fa-map-marker-alt"></i> ${place.formatted_address || 'Address not available'}</p>
                        ${place.formatted_phone_number ? `<p><i class="fas fa-phone"></i> ${place.formatted_phone_number}</p>` : ''}
                        ${place.rating ? `
                            <p>
                                <i class="fas fa-star text-warning"></i>
                                ${place.rating} / 5
                            </p>
                        ` : ''}
                        ${place.opening_hours ? `
                            <div class="mb-3">
                                <h6>Hours:</h6>
                                <ul class="list-unstyled">
                                    ${place.opening_hours.weekday_text.map(day => `<li>${day}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${place.website ? `
                            <p>
                                <a href="${place.website}" target="_blank" rel="noopener noreferrer">
                                    <i class="fas fa-globe"></i> Visit Website
                                </a>
                            </p>
                        ` : ''}
                        ${place.photos && place.photos.length > 0 ? `
                            <div class="place-photos">
                                <img src="${place.photos[0].getUrl()}" alt="${place.name}" class="img-fluid rounded">
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('placeDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add new modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('placeDetailsModal'));
    modal.show();
}

// Toggle favorite status
function toggleFavorite(placeId) {
    favorites[placeId] = !favorites[placeId];
    
    // Update heart icon
    const heartIcon = document.querySelector(`button[onclick="toggleFavorite('${placeId}')"] i`);
    if (heartIcon) {
        heartIcon.classList.toggle('text-danger');
    }
    
    // Save to localStorage
    localStorage.setItem('tennisClassFavorites', JSON.stringify(favorites));
    
    showToast(
        favorites[placeId] ? 'Added to favorites!' : 'Removed from favorites',
        favorites[placeId] ? 'success' : 'info'
    );
}

// Show toast messages
function showToast(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const toastBody = toast.querySelector('.toast-body');
    
    // Set message and style
    toastBody.textContent = message;
    toast.className = `toast ${type === 'error' ? 'bg-danger text-white' : 'bg-light'}`;
    
    // Show toast using Bootstrap
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Load favorites from localStorage
try {

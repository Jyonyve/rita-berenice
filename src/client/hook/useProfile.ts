// src/client/hooks/useProfile.ts
import { ProfileInfo, genApiUrl, apiClient } from '#root/src/shared/index.ts';
import { useState, useCallback, useEffect } from 'react';

// Define the module name used in API paths
const MODULE_NAME = 'profile';

export const useProfile = () => {
	// --- State ---
	const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
	const [currentProfile, setCurrentProfile] = useState<ProfileInfo>(); // Optional: if you need to track a selected profile
	const [loading, setLoading] = useState<boolean>(false);

	// --- API Call Functions ---

	const getAllProfiles = useCallback(async (): Promise<ProfileInfo[]> => {
		console.log('Fetching all profiles from API...');
		setLoading(true);
		try {
			const url = genApiUrl(MODULE_NAME, 'getAllProfiles');
			const response = await apiClient.get<ProfileInfo[]>(url);
			setProfiles(response.data); // Update local state
			console.log('Fetched profiles:', response.data);
			return response.data;
		} catch (error) {
			console.error('Failed to fetch profiles from API:', error);
			setProfiles([]); // Clear on error
			return [];
		} finally {
			setLoading(false);
		}
	}, []);

	const getProfileById = useCallback(async (id: string): Promise<ProfileInfo | null> => {
		console.log(`Fetching profile by ID ${id} from API...`);
		setLoading(true);
		try {
			const url = genApiUrl(MODULE_NAME, 'getProfileById', [id]);
			const response = await apiClient.get<ProfileInfo>(url);
			return response.data;
		} catch (error: any) {
			console.error(`Failed to fetch profile by ID ${id} from API:`, error);
			if (error.response?.status === 404) {
				console.log(`Profile with ID ${id} not found.`);
				return null;
			}
			return null; // Return null for other errors too
		} finally {
			setLoading(false);
		}
	}, []);

	const getProfilesBySessionId = useCallback(async (sessionId: string): Promise<ProfileInfo[]> => {
		console.log(`Fetching profiles by SessionID ${sessionId} from API...`);
		setLoading(true);
		try {
			const url = genApiUrl(MODULE_NAME, 'getProfilesBySessionId', [sessionId]);
			const response = await apiClient.get<ProfileInfo[]>(url);
			// This typically just returns the result, doesn't need to set global 'profiles' state
			return response.data;
		} catch (error) {
			console.error(`Failed to fetch profiles by SessionID ${sessionId} from API:`, error);
			return []; // Return empty array on error
		} finally {
			setLoading(false);
		}
	}, []);

	const storeProfile = useCallback(
		async (profileData: ProfileInfo): Promise<ProfileInfo | null> => {
			console.log('Storing profile via API:', profileData);
			setLoading(true);
			try {
				const url = genApiUrl(MODULE_NAME, 'storeProfile');
				const response = await apiClient.post<ProfileInfo>(url, profileData);
				console.log('Profile stored successfully via API:', response.data);

				// Refresh the main list after storing
				await getAllProfiles();

				return response.data; // Return stored/updated data
			} catch (error) {
				console.error('Failed to store profile via API:', error);
				throw error; // Re-throw for component-level handling
			} finally {
				setLoading(false);
			}
		},
		[getAllProfiles] // Depends on getAllProfiles for refresh
	);

	const queryProfiles = useCallback(
		async (query: string, limit: number = 10): Promise<ProfileInfo[]> => {
			console.log(`Querying profiles with "${query}" from API...`);
			setLoading(true);
			try {
				const url = genApiUrl(MODULE_NAME, 'queryProfiles');
				const response = await apiClient.get<ProfileInfo[]>(url, { params: { q: query, limit } });
				console.log('Query results:', response.data);
				// Usually just returns results, doesn't set global state unless needed
				return response.data;
			} catch (error) {
				console.error('Failed to query profiles from API:', error);
				return [];
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	// --- Client-Side Logic ---

	// Optional: Fetch all profiles when the hook is first used
	useEffect(() => {
		getAllProfiles();
	}, [getAllProfiles]);

	// Optional: Function to set the current profile from the local state
	const selectProfile = useCallback(
		(profileId: string) => {
			const profile = profiles.find((p) => p.id === profileId);
			setCurrentProfile(profile);
		},
		[profiles]
	);

	// --- Return Hook Values ---
	return {
		profiles, // List of all profiles (local state)
		currentProfile, // Currently selected profile (local state)
		loading, // Loading indicator

		// API functions
		getAllProfiles,
		getProfileById,
		getProfilesBySessionId,
		storeProfile,
		queryProfiles,

		// Client-side functions
		selectProfile, // Example function to set current profile
	};
};

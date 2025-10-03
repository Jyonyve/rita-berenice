import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../../provider/index.js';
import { GlassPaper } from '../../layout/component/glass/index.js';
import { routeConstants } from '../../routeConstants.js';
import { CharacterForm } from './CharacterForm.jsx';

export function NewCharacterPageLoader() {
	const { userId } = useAuth();
	const navigate = useNavigate();

	if (!userId) return;

	return (
		<GlassPaper>
			<CharacterForm
				mode="create"
				userId={userId}
				onCancel={() => navigate(`/${routeConstants.CHARACTER}`)}
				onSuccess={(id) => navigate(`/${routeConstants.CHARACTER}/${id}`)}
			/>
		</GlassPaper>
	);
}

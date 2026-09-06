import CandidateCard from "./CandidateCard";

/**
 * CandidateList
 *
 * Renders the candidates array from CandidateRunResponse. Never
 * shows placeholder/empty cards — an empty array renders the
 * explicit empty state instead.
 */

function CandidateList({ candidates, selectedCandidateId, onSelect }) {
  if (!candidates || candidates.length === 0) {
    return <div className="empty-state">No candidates were returned for this run.</div>;
  }

  return (
    <div className="candidate-list">
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.candidate_id}
          candidate={candidate}
          isSelected={candidate.candidate_id === selectedCandidateId}
          onSelect={() => onSelect(candidate.candidate_id)}
        />
      ))}
    </div>
  );
}

export default CandidateList;
